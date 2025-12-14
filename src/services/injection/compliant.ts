/**
 * 合规注入策略
 * 完全符合 Chrome Manifest V3 规范
 * 仅使用官方 API，不包含任何动态代码执行
 */

import type { UserScript, InjectionStrategy } from '../../core/types';
import { UserScriptsAPIManager } from '../userscripts-api';
import { InjectionUtils } from './utils';
import { CompliantScriptExecutor } from './compliant-executor';
import { isFeatureEnabled } from '../../config/feature-flags';

export class CompliantInjectionStrategy {
  /**
   * 注入脚本 - 合规版本
   */
  static async inject(script: UserScript, tabId: number): Promise<void> {
    console.log(`[CompliantInjection] Injecting script: ${script.meta.name}`);
    
    // 验证脚本是否符合合规要求
    const validation = CompliantScriptExecutor.validateScriptContent(script);
    if (!validation.safe) {
      console.warn(`[CompliantInjection] Script validation failed for ${script.meta.name}:`, validation.issues);
      
      // 在严格合规模式下，拒绝执行不安全的脚本
      if (isFeatureEnabled('storeCompliant')) {
        throw new Error(`Script ${script.meta.name} contains non-compliant code: ${validation.issues.join(', ')}`);
      }
    }
    
    // 优先使用 UserScripts API（合规方式）
    if (await this.canUseUserScriptsAPI()) {
      await this.injectViaUserScripts(script);
      return;
    }
    
    // 降级到 chrome.scripting API（合规方式）
    await this.injectViaScripting(script, tabId);
  }

  /**
   * 通过 UserScripts API 注入（完全合规）
   */
  private static async injectViaUserScripts(script: UserScript): Promise<void> {
    const strategy: InjectionStrategy = {
      method: 'userscripts-dynamic',
      world: 'USER_SCRIPT',
      timing: InjectionUtils.convertRunAtTiming(script.meta['run-at']),
      reason: 'Using UserScripts API for compliant execution'
    };

    // 使用合规的 UserScripts API 注册（不使用包装器）
    await UserScriptsAPIManager.registerScriptCompliant(script, strategy);
  }

  /**
   * 通过 chrome.scripting API 注入（合规方式）
   */
  private static async injectViaScripting(script: UserScript, tabId: number): Promise<void> {
    const needsIsolation = InjectionUtils.needsIsolation(script);
    const world = InjectionUtils.getWorldString(needsIsolation);

    // 注入 API Bridge（如果需要隔离）
    if (needsIsolation) {
      await InjectionUtils.injectAPIBridge(tabId, script.id);
    }

    // 使用合规的脚本执行器
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: CompliantScriptExecutor.createCompliantExecutor(),
      args: [script.content, script.meta.name],
      world: world as chrome.scripting.ExecutionWorld,
    });
  }

  /**
   * 检查是否可以使用 UserScripts API
   */
  private static async canUseUserScriptsAPI(): Promise<boolean> {
    return UserScriptsAPIManager.isAvailable();
  }

  /**
   * 获取策略信息
   */
  static getStrategyInfo(): { name: string; compliant: boolean; features: string[] } {
    return {
      name: 'Fully Compliant Injection Strategy',
      compliant: true,
      features: [
        'UserScripts API support (no wrappers)',
        'chrome.scripting API fallback',
        'Script content validation',
        'No eval() usage',
        'No Function constructor',
        'Trusted Types support',
        'CSP nonce support',
        'MV3 fully compliant'
      ]
    };
  }

  /**
   * 获取合规模式的限制信息
   */
  static getComplianceInfo() {
    return {
      restrictions: [
        'No dynamic code execution (eval, Function constructor)',
        'No string-based setTimeout/setInterval',
        'Limited innerHTML usage',
        'No dynamic script loading'
      ],
      alternatives: [
        'Use UserScripts API for script execution',
        'Use chrome.scripting API with static functions',
        'Use Trusted Types for safe content handling',
        'Use CSP nonces for script validation'
      ]
    };
  }
}