import type { Config } from '../types';

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v != null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export const storage = {
  getConfig: (): Config => load('triaje.cfg', { url: '', dev: 'esp32-triaje-01', eng: 'auto' }),
  saveConfig: (v: Config) => save('triaje.cfg', v),
};
