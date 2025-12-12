import type { UserScript } from '../types';

export function parseUserScript(content: string): Partial<UserScript> {
  const meta: any = {
    grant: [],
    match: [],
    require: [],
    compatible: [],
  };
  const lines = content.split('\\n');

  for (const line of lines) {
    if (line.trim().startsWith('// ==/UserScript==')) {
      break;
    }
    if (line.trim().startsWith('// @')) {
      const parts = line.trim().substring(4).split(' ');
      const key = parts.shift();
      const value = parts.join(' ').trim();
      if (key) {
        if (['grant', 'match', 'require', 'compatible'].includes(key)) {
          meta[key].push(value);
        } else {
          meta[key] = value;
        }
      }
    }
  }

  return {
    content,
    meta,
  };
}
