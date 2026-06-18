import { contextBridge, ipcRenderer } from 'electron';
import type { ItemScore } from './types';

export interface ScorePayload {
  score: ItemScore;
  advancedMode: boolean;
  name: string | null;
  baseType: string | null;
  rarity: string | null;
  dataVersion: string;
}

contextBridge.exposeInMainWorld('poe', {
  onScore: (cb: (payload: ScorePayload) => void) => {
    ipcRenderer.on('score', (_e, payload: ScorePayload) => cb(payload));
  },
  setClickThrough: (ignore: boolean) => ipcRenderer.send('set-click-through', ignore),
});
