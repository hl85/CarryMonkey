import type { UserScript } from './types';

export const getScripts = async (): Promise<UserScript[]> => {
  const result = await chrome.storage.local.get('scripts');
  return (result.scripts as UserScript[]) || [];
};

export const saveScript = async (script: UserScript): Promise<void> => {
  const scripts = await getScripts();
  scripts.push(script);
  await chrome.storage.local.set({ scripts });
};

export const deleteScripts = async (idsToDelete: string[]): Promise<void> => {
  const scripts = await getScripts();
  const remainingScripts = scripts.filter((s) => !idsToDelete.includes(s.id));
  await chrome.storage.local.set({ scripts: remainingScripts });
};

export const updateScript = async (updatedScript: UserScript): Promise<void> => {
  const scripts = await getScripts();
  const scriptIndex = scripts.findIndex((s) => s.id === updatedScript.id);
  if (scriptIndex > -1) {
    scripts[scriptIndex] = updatedScript;
    await chrome.storage.local.set({ scripts });
  }
};
