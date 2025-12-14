/**
 * 统一注入引擎
 * 根据构建模式和功能标志选择合适的注入策略
 */

import type { UserScript } from '../../core/types';
import { isFeatureEnabled } from '../../config/feature-flags';
import { CompliantInjectionStrategy } from './compliant';
import { CompatibilityInjectionStrategy } from './legacy';
import { InjectionStrategySelector } from '../injection-strategy';
import { CompliantScriptExecutor } from './compliant-executor';

export class UnifiedInjectionEngine {
  /**
   * 智能注入脚本
   * 根据构建模式和功能标志自动选择策略
   */
  static async injectScript(script: UserScript, tabId: number): Promise<void> {
    console.log(`[UnifiedInjectionEngine] Processing script: ${script.meta.name}`);
    
    // 获取策略选择结果
    const strategy = InjectionStrategySelector.selectStrategy(script);
    script.meta._injectionStrategy = strategy;
    
    console.log(`[UnifiedInjectionEngine] Selected strategy:`, strategy);
    
    // 在严格合规模式下，验证脚本内容
    if (isFeatureEnabled('storeCompliant')) {
      const validation = CompliantScriptExecutor.validateScriptContent(script);
      if (!validation.safe) {
        console.error(`[UnifiedInjectionEngine] Script validation failed for ${script.meta.name}:`, validation.issues);
        throw new Error(`Script contains non-compliant code: ${validation.issues.join(', ')}`);
      }
    }
    
    try {
      // 根据构建模式选择注入实现
      if (isFeatureEnabled('storeCompliant')) {
        // 严格合规模式：仅使用合规策略
        await CompliantInjectionStrategy.inject(script, tabId);
      } else if (isFeatureEnabled('legacyInjection')) {
        // 兼容模式：使用兼容策略
        await CompatibilityInjectionStrategy.inject(script, tabId);
      } else {
        // 默认模式：优先合规，失败时降级
        try {
          await CompliantInjectionStrategy.inject(script, tabId);
        } catch (compliantError) {
          console.warn(`[UnifiedInjectionEngine] Compliant injection failed, trying compatibility mode:`, compliantError);
          await CompatibilityInjectionStrategy.inject(script, tabId);
        }
      }
      
      console.log(`[UnifiedInjectionEngine] Successfully injected: ${script.meta.name}`);
    } catch (error) {
      console.error(`[UnifiedInjectionEngine] Injection failed for ${script.meta.name}:`, error);
      
      // 在非严格模式下，如果支持降级，尝试兼容策略
      if (!isFeatureEnabled('storeCompliant') && !isFeatureEnabled('legacyInjection') && isFeatureEnabled('evalFallback')) {
        console.log(`[UnifiedInjectionEngine] Attempting emergency fallback for: ${script.meta.name}`);
        try {
          await CompatibilityInjectionStrategy.inject(script, tabId);
          console.log(`[UnifiedInjectionEngine] Emergency fallback successful: ${script.meta.name}`);
        } catch (fallbackError) {
          console.error(`[UnifiedInjectionEngine] Emergency fallback also failed:`, fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 批量注入脚本
   */
  static async injectMultipleScripts(scripts: UserScript[], tabId: number): Promise<void> {
    console.log(`[UnifiedInjectionEngine] Batch injecting ${scripts.length} scripts`);
    
    const results = await Promise.allSettled(
      scripts.map(script => this.injectScript(script, tabId))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`[UnifiedInjectionEngine] Batch injection complete: ${successful} successful, ${failed} failed`);
    
    // 记录失败的脚本
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[UnifiedInjectionEngine] Failed to inject ${scripts[index].meta.name}:`, result.reason);
      }
    });
  }

  /**
   * 获取引擎状态信息
   */
  static getEngineInfo() {
    const storeCompliant = isFeatureEnabled('storeCompliant');
    const legacyEnabled = isFeatureEnabled('legacyInjection');
    const evalFallback = isFeatureEnabled('evalFallback');
    
    let mode = 'hybrid';
    if (storeCompliant) {
      mode = 'strict-compliant';
    } else if (legacyEnabled) {
      mode = 'compatibility';
    }
    
    return {
      engine: 'UnifiedInjectionEngine',
      version: '3.0.0',
      mode,
      compliance: {
        storeCompliant: storeCompliant,
        mv3Compliant: storeCompliant || !legacyEnabled,
        webStoreReady: storeCompliant
      },
      features: {
        storeCompliant: storeCompliant,
        legacyInjection: legacyEnabled,
        evalFallback: evalFallback,
        userScriptsAPI: isFeatureEnabled('userScriptsAPI'),
        dynamicCodeExecution: isFeatureEnabled('dynamicCodeExecution'),
        strictCSP: isFeatureEnabled('strictCSP'),
        scriptValidation: storeCompliant
      },
      strategies: {
        compliant: CompliantInjectionStrategy.getStrategyInfo(),
        compatibility: CompatibilityInjectionStrategy.getStrategyInfo()
      },
      executor: CompliantScriptExecutor.getExecutorInfo()
    };
  }

  /**
   * 健康检查
   */
  static async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; issues: string[] }> {
    const issues: string[] = [];
    
    // 检查 UserScripts API 可用性
    if (isFeatureEnabled('userScriptsAPI') && !chrome.userScripts) {
      issues.push('UserScripts API not available but feature is enabled');
    }
    
    // 检查权限
    try {
      const permissions = await chrome.permissions.getAll();
      const requiredPermissions = ['scripting', 'tabs', 'activeTab'] as const;
      
      for (const permission of requiredPermissions) {
        if (!permissions.permissions?.includes(permission as chrome.runtime.ManifestPermission)) {
          issues.push(`Missing required permission: ${permission}`);
        }
      }
      
      if (isFeatureEnabled('userScriptsAPI') && !permissions.permissions?.includes('userScripts')) {
        issues.push('Missing userScripts permission but feature is enabled');
      }
    } catch (error) {
      issues.push(`Permission check failed: ${error}`);
    }
    
    // 确定状态
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.some(issue => issue.includes('required permission'))) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }
    
    return { status, issues };
  }
}