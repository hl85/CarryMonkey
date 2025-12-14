import type { UserScript, InjectionStrategy } from '../core/types';
import { InjectionUtils } from './injection/utils';

/**
 * 智能注入策略选择器
 * 根据脚本特性选择最优的注入方式
 */
export class InjectionStrategySelector {
  /**
   * 选择最优注入策略
   */
  static selectStrategy(script: UserScript): InjectionStrategy {
    // 1. 评估 @grant 权限
    const grants = script.meta.grant || [];
    const hasGMAPIs = grants.length > 0 && !grants.every(g => g === 'none');
    const hasSpecialAPIs = grants.some(g => 
      ['GM_setValue', 'GM_getValue', 'GM_xmlhttpRequest', 'GM_getResourceText', 'GM_getResourceURL'].includes(g)
    );

    // 2. 评估 @run-at 时机
    const runAt = script.meta['run-at'] || 'document-end';
    const needsEarlyExecution = runAt === 'document-start';

    // 3. 评估 @sandbox 模式
    const sandboxMode = script.meta.sandbox || 'raw';
    const needsIsolation = sandboxMode !== 'raw' || hasGMAPIs;

    // 4. 检查是否支持 UserScripts API
    const supportsUserScriptsAPI = this.checkUserScriptsAPISupport();

    // 5. 策略选择逻辑
    if (needsEarlyExecution && hasSpecialAPIs && supportsUserScriptsAPI) {
      return {
        method: 'userscripts-dynamic',
        world: 'USER_SCRIPT',
        timing: 'document_start',
        reason: 'Early execution with GM APIs requires dynamic UserScripts API'
      };
    }

    if (hasSpecialAPIs && supportsUserScriptsAPI) {
      return {
        method: 'userscripts-api',
        world: 'USER_SCRIPT',
        timing: this.convertRunAtTiming(runAt),
        reason: 'GM APIs require UserScripts API with message passing'
      };
    }

    if (needsIsolation) {
      return {
        method: 'content-script',
        world: 'USER_SCRIPT',
        timing: this.convertRunAtTiming(runAt),
        reason: 'Isolation required but UserScripts API not available, using content script'
      };
    }

    return {
      method: 'content-script',
      world: 'MAIN',
      timing: this.convertRunAtTiming(runAt),
      reason: 'Simple script without special requirements, using direct injection'
    };
  }

  /**
   * 检查 UserScripts API 是否可用
   */
  private static checkUserScriptsAPISupport(): boolean {
    return InjectionUtils.canUseUserScriptsAPI();
  }

  /**
   * 转换 run-at 时机到 Chrome API 格式
   */
  private static convertRunAtTiming(runAt: string): 'document_start' | 'document_end' | 'document_idle' {
    return InjectionUtils.convertRunAtTiming(runAt);
  }

  /**
   * 评估脚本复杂度
   */
  static evaluateScriptComplexity(script: UserScript): 'simple' | 'moderate' | 'complex' {
    const grants = script.meta.grant || [];
    const hasRequires = (script.meta.require || []).length > 0;
    const hasResources = Object.keys(script.meta.resource || {}).length > 0;
    const hasConnect = (script.meta.connect || []).length > 0;

    if (grants.length > 3 || hasRequires || hasResources || hasConnect) {
      return 'complex';
    }

    if (grants.length > 1 || grants.some(g => g !== 'none')) {
      return 'moderate';
    }

    return 'simple';
  }

  /**
   * 获取策略优先级分数（用于调试和优化）
   */
  static getStrategyScore(strategy: InjectionStrategy, script: UserScript): number {
    let score = 0;

    // 基础分数
    if (strategy.method === 'userscripts-dynamic') score += 100;
    else if (strategy.method === 'userscripts-api') score += 80;
    else score += 60;

    // 时机匹配分数
    const requestedTiming = script.meta['run-at'] || 'document-end';
    if (this.convertRunAtTiming(requestedTiming) === strategy.timing) {
      score += 20;
    }

    // 功能需求匹配分数
    const grants = script.meta.grant || [];
    const hasGMAPIs = grants.some(g => g !== 'none');
    if (hasGMAPIs && strategy.world === 'USER_SCRIPT') {
      score += 15;
    }

    return score;
  }
}