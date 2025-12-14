/**
 * 注入辅助工具类
 * 提取公共的注入辅助方法，避免代码重复
 */

import type { UserScript } from '../../core/types';
import { isFeatureEnabled } from '../../config/feature-flags';
import { CompliantScriptExecutor } from './compliant-executor';

export class InjectionUtils {
  /**
   * 判断脚本是否需要隔离环境
   * 基于 @grant 权限判断
   */
  static needsIsolation(script: UserScript): boolean {
    const grants = script.meta.grant || [];
    return grants.length > 0 && !grants.every(g => g === 'none');
  }

  /**
   * 转换 @run-at 时机到 Chrome API 格式
   */
  static convertRunAtTiming(runAt: string): 'document_start' | 'document_end' | 'document_idle' {
    switch (runAt) {
      case 'document-start':
        return 'document_start';
      case 'document-end':
        return 'document_end';
      case 'document-idle':
        return 'document_idle';
      default:
        return 'document_end';
    }
  }

  /**
   * 注入 API Bridge 到指定标签页
   */
  static async injectAPIBridge(tabId: number, scriptId: string): Promise<void> {
    // 设置当前脚本 ID
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (id: string) => { window.currentScriptId = id; },
      args: [scriptId],
      world: 'ISOLATED',
    });

    // 注入 API Bridge
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['src/content-scripts/api-bridge.js'],
      world: 'ISOLATED',
    });
  }

  /**
   * 获取适当的脚本执行器
   * 根据构建模式和功能标志选择合规或兼容执行器
   */
  static getScriptExecutor() {
    // 检查是否为严格合规模式
    if (isFeatureEnabled('storeCompliant') && !isFeatureEnabled('dynamicCodeExecution')) {
      return CompliantScriptExecutor.createCompliantExecutor();
    }
    
    // 检查是否启用动态代码执行
    if (isFeatureEnabled('dynamicCodeExecution')) {
      return this.createEnhancedScriptExecutor();
    }
    
    // 默认使用基础执行器（仍包含 Function 构造器，用于兼容模式）
    return this.createBaseScriptExecutor();
  }

  /**
   * 创建基础的脚本执行器（兼容模式）
   * 使用 Function 构造器，仅在兼容模式下使用
   */
  static createBaseScriptExecutor() {
    return function(scriptContent: string, scriptName: string) {
      console.warn(`[CarryMonkey] Using legacy Function constructor for: ${scriptName}`);
      try {
        // 警告：这违反了严格的 MV3 合规性，仅用于兼容模式
        const scriptFunction = new Function('window', 'document', 'console', `
          'use strict';
          ${scriptContent}
        `);
        
        scriptFunction.call(window, window, document, console);
        console.log(`[CarryMonkey] Script executed: ${scriptName}`);
      } catch (error) {
        console.error(`[CarryMonkey] Script execution failed: ${scriptName}`, error);
      }
    };
  }

  /**
   * 创建增强的脚本执行器（完全兼容模式）
   * 包含多种注入方法的降级策略，包括 eval
   */
  static createEnhancedScriptExecutor() {
    return function(scriptContent: string, scriptName: string) {
      console.log(`[CarryMonkey Enhanced] Executing script: ${scriptName}`);

      // 方法1: 尝试 script 标签注入
      if (tryScriptTagInjection(scriptContent)) {
        console.log(`[CarryMonkey Enhanced] Script tag injection successful: ${scriptName}`);
        return;
      }

      // 方法2: 尝试 Function 构造器
      if (tryFunctionConstructor(scriptContent)) {
        console.log(`[CarryMonkey Enhanced] Function constructor successful: ${scriptName}`);
        return;
      }

      // 方法3: eval 降级（最后手段）
      if (tryEvalFallback(scriptContent)) {
        console.log(`[CarryMonkey Enhanced] Eval fallback successful: ${scriptName}`);
        return;
      }

      console.error(`[CarryMonkey Enhanced] All injection methods failed: ${scriptName}`);

      // 内部函数：script 标签注入
      function tryScriptTagInjection(code: string): boolean {
        try {
          const script = document.createElement('script');
          script.textContent = code;
          
          // 支持 CSP nonce
          const nonce = document.querySelector('script[nonce]')?.getAttribute('nonce');
          if (nonce) {
            script.setAttribute('nonce', nonce);
          }

          // 支持 Trusted Types
          if (window.trustedTypes && window.trustedTypes.createPolicy) {
            const policy = window.trustedTypes.createPolicy('carrymonkey-injection', {
              createScript: (input: string) => input
            });
            script.textContent = policy.createScript(code) as string;
          }

          (document.head || document.documentElement).appendChild(script);
          script.remove();
          return true;
        } catch (error) {
          console.warn('[CarryMonkey Enhanced] Script tag injection failed:', error);
          return false;
        }
      }

      // 内部函数：Function 构造器
      function tryFunctionConstructor(code: string): boolean {
        try {
          const scriptFunction = new Function('window', 'document', 'console', `
            'use strict';
            ${code}
          `);
          scriptFunction.call(window, window, document, console);
          return true;
        } catch (error) {
          console.warn('[CarryMonkey Enhanced] Function constructor failed:', error);
          return false;
        }
      }

      // 内部函数：eval 降级
      function tryEvalFallback(code: string): boolean {
        try {
          // 警告：这违反了 MV3 规范，仅用于完全兼容模式
          eval(code);
          return true;
        } catch (error) {
          console.error('[CarryMonkey Enhanced] Eval fallback failed:', error);
          return false;
        }
      }
    };
  }

  /**
   * 检查是否可以使用 UserScripts API
   */
  static canUseUserScriptsAPI(): boolean {
    return typeof chrome !== 'undefined' && 
           chrome.userScripts !== undefined &&
           typeof chrome.userScripts.register === 'function';
  }

  /**
   * 获取世界类型字符串
   */
  static getWorldString(isolated: boolean): chrome.scripting.ExecutionWorld {
    return isolated ? 'ISOLATED' as chrome.scripting.ExecutionWorld : 'MAIN' as chrome.scripting.ExecutionWorld;
  }

  /**
   * 安全地执行脚本内容
   * 根据构建模式选择合适的执行方式
   */
  static async executeScriptContent(
    scriptContent: string, 
    scriptName: string, 
    tabId: number,
    world: chrome.scripting.ExecutionWorld = 'MAIN' as chrome.scripting.ExecutionWorld
  ): Promise<boolean> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: this.getScriptExecutor(),
        args: [scriptContent, scriptName],
        world,
      });
      return true;
    } catch (error) {
      console.warn(`[InjectionUtils] Script execution failed: ${scriptName}`, error);
      return false;
    }
  }

  /**
   * 验证脚本是否适合当前构建模式
   */
  static validateScriptForCurrentMode(script: UserScript): { valid: boolean; issues: string[] } {
    if (isFeatureEnabled('storeCompliant')) {
      const validation = CompliantScriptExecutor.validateScriptContent(script);
      return { valid: validation.safe, issues: validation.issues };
    }
    
    // 兼容模式下允许所有脚本
    return { valid: true, issues: [] };
  }
}