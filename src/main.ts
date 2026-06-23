import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import { parseItem } from './parser';
import { scoreItem } from './scorer';
import { dataVersion } from './data';
import { loadFavorites, toggleFavorite } from './favorites';
import type { ItemScore, ParsedItem } from './types';

// --- How this works on the gaming PC ---
// 1. Run PoE2 in *Windowed Fullscreen (Borderless)* — exclusive fullscreen hides
//    overlays on Windows.
// 2. Enable "Advanced Mod Descriptions" in PoE2 options (puts tier + range into
//    copied text).
// 3. Hover an item, press Ctrl+C (the game's own copy). This app watches the
//    clipboard, scores the item, and shows it. No input is simulated, no network
//    calls are made — strictly within GGG's "one action per keypress" guidance.
//
// UI flow: each Ctrl+C pops a thin collapsed line (auto-hides after 5s). Click it
// to expand the full breakdown, which stays until dismissed. The window is hidden
// when idle, so it only ever appears right after you copy something.

let win: BrowserWindow | null = null;
let lastText = '';
let lastItem: ParsedItem | null = null; // re-scored when favorites change
const favorites = loadFavorites();

const POLL_MS = 350;
const WIN_W = 360;
const COLLAPSED_H = 42;
const MARGIN = 24;
const debug = process.env.POE_DEBUG === '1';

// Helps Electron draw reliably on virtualized GPUs (cloud PCs like Shadow),
// where hardware-accelerated compositing can leave the window black/invisible.
app.disableHardwareAcceleration();

function looksLikeItem(text: string): boolean {
  return /^Item Class:/m.test(text) && text.includes('--------');
}

// Keep the window pinned to the top-right of the work area at a given height.
function anchorTopRight(height: number) {
  if (!win) return;
  const wa = screen.getPrimaryDisplay().workArea;
  win.setBounds({
    x: wa.x + wa.width - WIN_W - MARGIN,
    y: wa.y + MARGIN,
    width: WIN_W,
    height: Math.max(COLLAPSED_H, Math.round(height)),
  });
}

function createWindow() {
  // See-through is opt-in (POE_TRANSPARENT=1): transparent windows are invisible
  // on cloud/virtual GPUs. The window must be interactive so you can click the
  // collapsed line to expand it — so click-through is off by default here.
  const transparent = process.env.POE_TRANSPARENT === '1';
  const clickThrough = process.env.POE_CLICKTHROUGH === '1';

  win = new BrowserWindow({
    width: WIN_W,
    height: COLLAPSED_H,
    frame: false,
    show: debug, // hidden until first item; shown immediately when debugging
    transparent,
    backgroundColor: transparent ? undefined : '#0e0e12',
    resizable: false,
    skipTaskbar: !debug,
    alwaysOnTop: true,
    focusable: !clickThrough,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver'); // above borderless-fullscreen games
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (clickThrough) win.setIgnoreMouseEvents(true, { forward: true });

  anchorTopRight(COLLAPSED_H);
  win.loadFile(path.join(__dirname, '..', 'overlay.html'));
  if (debug) win.webContents.openDevTools({ mode: 'detach' });
}

// Score an item and push it to the overlay. `expanded` keeps the full card open
// (used when re-scoring after a favorite toggle, so the view doesn't collapse).
function emitScore(item: ParsedItem, expanded = false) {
  const score: ItemScore = scoreItem(item, favorites);
  console.log(`[score] ${item.name ?? item.baseType ?? '?'} -> [${score.x}/${score.y}]${score.keeper ? ' ★keeper' : ''}`);
  if (win && !win.isVisible()) win.showInactive(); // appear without stealing game focus
  win?.webContents.send('score', {
    score,
    advancedMode: item.advancedMode,
    name: item.name,
    baseType: item.baseType,
    rarity: item.rarity,
    dataVersion,
    expanded,
  });
}

function pollClipboard() {
  let text = '';
  try {
    text = clipboard.readText();
  } catch {
    return;
  }
  if (text === lastText || !looksLikeItem(text)) return;
  lastText = text;

  lastItem = parseItem(text);
  emitScore(lastItem);
}

app.whenReady().then(() => {
  createWindow();
  const timer = setInterval(pollClipboard, POLL_MS);

  globalShortcut.register('Control+Shift+S', () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.showInactive();
  });
  globalShortcut.register('Control+Shift+Q', () => app.quit());

  app.on('will-quit', () => {
    clearInterval(timer);
    globalShortcut.unregisterAll();
  });
});

// Renderer drives sizing (collapsed vs expanded) and dismissal.
ipcMain.on('resize', (_e, height: number) => anchorTopRight(height));
ipcMain.on('dismiss', () => {
  if (!debug) win?.hide();
});
// Star toggled in the overlay: update the wishlist, persist, re-score in place.
ipcMain.on('toggle-favorite', (_e, groupKey: string) => {
  toggleFavorite(favorites, groupKey);
  if (lastItem) emitScore(lastItem, true);
});

app.on('window-all-closed', () => app.quit());
