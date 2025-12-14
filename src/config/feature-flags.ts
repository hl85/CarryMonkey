/**
 * 功能开关配置
 * 运行时功能控制
 */

import { getCurrentBuildMode } from './build-modes';

/**
 * 功能标志类型
 */
export interface FeatureFlags {
  // 注入策略相关
  userScriptsAPI: boolean;
  legacyInjection: boolean;
  dynamicCodeExecution: boolean;
  strictCSP: boolean;
  evalFallback: boolean;
  
  // 构建信息
  buildMode: string;
  storeCompliant: boolean;
  version: string;
}

/**
 * 获取运行时功能标志
 */
export function getFeatureFlags(): FeatureFlags {
  const mode = getCurrentBuildMode();
  
  return {
    // 功能特性
    userScriptsAPI: mode.features.userScriptsAPI,
    legacyInjection: mode.features.legacyInjection,
    dynamicCodeExecution: mode.features.dynamicCodeExecution,
    strictCSP: mode.features.strictCSP,
    evalFallback: mode.features.evalFallback,
    
    // 构建信息
    buildMode: mode.name,
    storeCompliant: mode.storeCompliant,
    version: process.env.npm_package_version || '1.0.0'
  };
}

/**
 * 检查特定功能是否启用
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return Boolean(flags[feature]);
}

/**
 * 获取调试信息
 */
export function getDebugInfo() {
  const flags = getFeatureFlags();
  const mode = getCurrentBuildMode();
  
  return {
    buildMode: flags.buildMode,
    storeCompliant: flags.storeCompliant,
    permissions: mode.permissions,
    features: mode.features,
    minimumChromeVersion: mode.minimumChromeVersion,
    buildTime: new Date().toISOString()
  };
}