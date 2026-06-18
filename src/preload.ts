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
  resize: (height: number) => ipcRenderer.send('resize', height),
  dismiss: () => ipcRenderer.send('dismiss'),
  debug: process.env.POE_DEBUG === '1',
});
