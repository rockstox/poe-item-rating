import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import { parseItem } from './parser';
import { scoreItem } from './scorer';
import type { ItemScore } from './types';

// --- How this works on the gaming PC ---
// 1. Run PoE2 in *Windowed Fullscreen (Borderless)* — exclusive fullscreen hides
//    overlays on Windows.
// 2. Enable "Advanced Mod Descriptions" in PoE2 options (puts tier + range into
//    copied text).
// 3. Hover an item, press Ctrl+C (the game's own copy). This app watches the
//    clipboard, scores the item, and shows it. No input is simulated, no network
//    calls are made — strictly within GGG's "one action per keypress" guidance.

let win: BrowserWindow | null = null;
let lastText = '';

const POLL_MS = 350;

function looksLikeItem(text: string): boolean {
  return /^Item Class:/m.test(text) && text.includes('--------');
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const W = 380;
  const H = 460;

  win = new BrowserWindow({
    width: W,
    height: H,
    x: width - W - 24,
    y: 24,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Stay above borderless-fullscreen games.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Let clicks pass through to the game; renderer regions re-enable as needed.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, '..', 'overlay.html'));
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

  const item = parseItem(text);
  const score: ItemScore = scoreItem(item);
  console.log(`[score] ${item.name ?? item.baseType ?? '?'} -> [${score.x}/${score.y}]`);
  win?.webContents.send('score', {
    score,
    advancedMode: item.advancedMode,
    name: item.name,
    baseType: item.baseType,
    rarity: item.rarity,
  });
}

app.whenReady().then(() => {
  createWindow();
  const timer = setInterval(pollClipboard, POLL_MS);

  // Toggle overlay visibility / quit without touching the game.
  globalShortcut.register('Control+Shift+S', () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
  globalShortcut.register('Control+Shift+Q', () => app.quit());

  app.on('will-quit', () => {
    clearInterval(timer);
    globalShortcut.unregisterAll();
  });
});

// Renderer can ask to (un)capture the mouse for interactive regions later.
ipcMain.on('set-click-through', (_e, ignore: boolean) => {
  win?.setIgnoreMouseEvents(ignore, { forward: true });
});

app.on('window-all-closed', () => app.quit());
