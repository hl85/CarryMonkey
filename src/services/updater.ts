import type { UserScript } from '../types';

export async function checkForUpdates(script: UserScript): Promise<boolean> {
  if (!script.meta.updateURL) {
    return false;
  }

  try {
    const response = await fetch(script.meta.updateURL);
    const metaContent = await response.text();
    // Simple version check, a more robust parser would be needed for a full implementation
    const newVersionMatch = metaContent.match(/@version\\s+([\\d.]+)/);
    if (newVersionMatch) {
      const newVersion = newVersionMatch[1];
      return newVersion !== script.meta.version;
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }

  return false;
}

export async function applyUpdate(script: UserScript): Promise<UserScript | null> {
  if (!script.meta.downloadURL) {
    return null;
  }

  try {
    const response = await fetch(script.meta.downloadURL);
    const newContent = await response.text();
    // In a real application, you would replace the old script content with the new one.
    // Here we just return a new UserScript object.
    console.log(`Updating script ${script.meta.name} to new version.`);
    return {
      ...script,
      content: newContent,
      // You would re-parse the metadata here to get the new version, etc.
    };
  } catch (error) {
    console.error('Failed to apply update:', error);
  }

  return null;
}
