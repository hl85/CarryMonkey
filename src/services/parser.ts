import type { UserScript, Grant, RunAt } from '../core/types';

export function parseUserScript(content: string): Partial<UserScript> {

  const meta: Partial<UserScript['meta']> & { [key: string]: string | string[] } = {
    name: '',
    namespace: '',

    version: '',
    description: '',
    author: '',
    match: [],
    icon: '',
    grant: [],
    copyright: '',
    license: '',
    source: '',
    supportURL: '',
    require: [],
    compatible: [],
    downloadURL: '',
    updateURL: '',
    'run-at': 'document-idle',
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
      if (key && value) {
        if (key === 'grant') {
          meta.grant!.push(value as Grant);
        } else if (['match', 'require', 'compatible'].includes(key)) {
          (meta[key as keyof typeof meta] as string[])?.push(value);
        } else if (key === 'run-at') {
          meta['run-at'] = value as RunAt;
        } else {
          // Handle other string properties
          meta[key] = value;
        }


      }
    }
  }

  return {
    content,
    meta: meta as UserScript['meta'],
  };
}
