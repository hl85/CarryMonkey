import type { UserScript, InjectionStrategy } from '../core/types';

/**
 * UserScripts API 管理器
 * 封装 Chrome UserScripts API 的使用
 */
export class UserScriptsAPIManager {
  private static registeredScripts = new Map<string, chrome.userScripts.RegisteredUserScript>();

  /**
   * 检查 UserScripts API 是否可用
   */
  static isAvailable(): boolean {
    return typeof chrome !== 'undefined' && 
           chrome.userScripts !== undefined &&
           typeof chrome.userScripts.register === 'function';
  }

  /**
   * 注册脚本到 UserScripts API（兼容模式，使用包装器）
   */
  static async registerScript(script: UserScript, strategy: InjectionStrategy): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('UserScripts API is not available');
    }

    // 先注销已存在的脚本
    await this.unregisterScript(script.id);

    const userScript: chrome.userScripts.RegisteredUserScript = {
      id: script.id,
      matches: script.meta.match || [],
      js: strategy.method === 'userscripts-dynamic' 
        ? [{ code: script.content }]
        : [{ code: this.generateWrapper(script) }],
      runAt: strategy.timing,
      world: strategy.world,
      allFrames: true
    };

    try {
      await chrome.userScripts.register([userScript]);
      this.registeredScripts.set(script.id, userScript);
      console.log(`[UserScripts API] Registered script: ${script.meta.name} (${script.id})`);
    } catch (error) {
      console.error(`[UserScripts API] Failed to register script ${script.id}:`, error);
      throw error;
    }
  }

  /**
   * 注册脚本到 UserScripts API（合规模式，不使用包装器）
   */
  static async registerScriptCompliant(script: UserScript, strategy: InjectionStrategy): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('UserScripts API is not available');
    }

    // 先注销已存在的脚本
    await this.unregisterScript(script.id);

    // 合规模式：直接注册脚本内容，不使用动态包装器
    const userScript: chrome.userScripts.RegisteredUserScript = {
      id: script.id,
      matches: script.meta.match || [],
      js: [{ code: script.content }], // 直接使用脚本内容，不包装
      runAt: strategy.timing,
      world: strategy.world,
      allFrames: true
    };

    try {
      await chrome.userScripts.register([userScript]);
      this.registeredScripts.set(script.id, userScript);
      console.log(`[UserScripts API Compliant] Registered script: ${script.meta.name} (${script.id})`);
    } catch (error) {
      console.error(`[UserScripts API Compliant] Failed to register script ${script.id}:`, error);
      throw error;
    }
  }

  /**
   * 注销脚本
   */
  static async unregisterScript(scriptId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    if (this.registeredScripts.has(scriptId)) {
      try {
        await chrome.userScripts.unregister({ ids: [scriptId] });
        this.registeredScripts.delete(scriptId);
        console.log(`[UserScripts API] Unregistered script: ${scriptId}`);
      } catch (error) {
        console.error(`[UserScripts API] Failed to unregister script ${scriptId}:`, error);
      }
    }
  }

  /**
   * 注销所有脚本
   */
  static async unregisterAll(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await chrome.userScripts.unregister();
      this.registeredScripts.clear();
      console.log('[UserScripts API] Unregistered all scripts');
    } catch (error) {
      console.error('[UserScripts API] Failed to unregister all scripts:', error);
    }
  }

  /**
   * 获取已注册的脚本列表
   */
  static getRegisteredScripts(): string[] {
    return Array.from(this.registeredScripts.keys());
  }

  /**
   * 生成包装器代码（用于兼容模式的 userscripts-api）
   * 警告：此方法使用 Function 构造器，不符合严格的 MV3 合规性
   */
  private static generateWrapper(script: UserScript): string {
    console.warn(`[UserScripts API] Using non-compliant wrapper for script: ${script.meta.name}`);
    
    return `
      (function() {
        'use strict';
        
        console.warn('[CarryMonkey] Using legacy wrapper mode - not MV3 compliant');
        
        // 请求脚本内容
        chrome.runtime.sendMessage({
          action: 'getUserScript',
          scriptId: '${script.id}'
        }, (response) => {
          if (response && response.status === 'success' && response.data) {
            try {
              // 警告：使用 Function 构造器违反 MV3 合规性
              const scriptFunction = new Function(
                'GM_setValue', 'GM_getValue', 'GM_getResourceText', 
                'GM_getResourceURL', 'GM_xmlhttpRequest', 'GM_info',
                response.data
              );
              
              // 绑定 GM API
              scriptFunction.call(window, 
                window.GM_setValue,
                window.GM_getValue, 
                window.GM_getResourceText,
                window.GM_getResourceURL,
                window.GM_xmlhttpRequest,
                {
                  script: {
                    name: '${script.meta.name}',
                    namespace: '${script.meta.namespace}',
                    version: '${script.meta.version}',
                    description: '${script.meta.description}',
                    author: '${script.meta.author}'
                  },
                  scriptMetaStr: \`${JSON.stringify(script.meta).replace(/`/g, '\\`')}\`,
                  version: '1.0.0',
                  scriptHandler: 'CarryMonkey'
                }
              );
            } catch (error) {
              console.error('[CarryMonkey] Script execution error:', error);
            }
          }
        });
      })();
    `;
  }

  

  /**
   * 更新脚本
   */
  static async updateScript(script: UserScript, strategy: InjectionStrategy): Promise<void> {
    await this.registerScript(script, strategy);
  }

  /**
   * 获取脚本状态
   */
  static getScriptStatus(scriptId: string): 'registered' | 'not-registered' {
    return this.registeredScripts.has(scriptId) ? 'registered' : 'not-registered';
  }

  /**
   * 批量注册脚本
   */
  static async registerMultipleScripts(
    scripts: Array<{ script: UserScript; strategy: InjectionStrategy }>
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('UserScripts API is not available');
    }

    const userScripts: chrome.userScripts.RegisteredUserScript[] = [];
    
    for (const { script, strategy } of scripts) {
      const userScript: chrome.userScripts.RegisteredUserScript = {
        id: script.id,
        matches: script.meta.match || [],
        js: strategy.method === 'userscripts-dynamic' 
          ? [{ code: script.content }]
          : [{ code: this.generateWrapper(script) }],
        runAt: strategy.timing,
        world: strategy.world,
        allFrames: true
      };
      
      userScripts.push(userScript);
      this.registeredScripts.set(script.id, userScript);
    }

    try {
      await chrome.userScripts.register(userScripts);
      console.log(`[UserScripts API] Batch registered ${userScripts.length} scripts`);
    } catch (error) {
      console.error('[UserScripts API] Failed to batch register scripts:', error);
      throw error;
    }
  }
}