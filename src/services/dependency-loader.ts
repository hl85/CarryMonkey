import type { UserScript } from '../types';

export async function loadDependencies(script: UserScript): Promise<void> {
  if (!script.meta.require || script.meta.require.length === 0) {
    return;
  }

  for (const url of script.meta.require) {
    try {
      const response = await fetch(url);
      await response.text();
      // In a real browser environment, you would inject this script into the page.
      // For example, by creating a <script> element.
      console.log(`Loading dependency: ${url}`);
      // eval(scriptContent); // Be very careful with eval in a real application!
    } catch (error) {
      console.error(`Failed to load dependency: ${url}`, error);
    }
  }
}
