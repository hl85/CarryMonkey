import type { UserScript } from '../core/types';
import { ScriptResourceManager } from './script-resource-manager';

/**
 * 加载脚本依赖（已废弃）
 * 请使用 ScriptResourceManager.cacheDependencies() 代替
 * @deprecated 使用 ScriptResourceManager.cacheDependencies() 代替
 */
export async function loadDependencies(script: UserScript): Promise<void> {
  console.warn('[DEPRECATED] loadDependencies is deprecated. Use ScriptResourceManager.cacheDependencies() instead.');
  
  if (!script.meta.require || script.meta.require.length === 0) {
    return;
  }

  const resourceManager = ScriptResourceManager.getInstance();
  await resourceManager.cacheDependencies(script.meta.require);
}
