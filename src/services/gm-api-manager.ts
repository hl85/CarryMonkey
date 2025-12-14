/**
 * GM API 管理器
 * 统一管理所有 GM_* API 的实现和调用
 */

import type { UserScript } from '../core/types';

export interface GMAPIPayload {
  key?: string;
  value?: unknown;
  defaultValue?: unknown;
  scriptId?: string;
  resourceName?: string;
  details?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: string;
  };
}

export interface GMAPIResponse {
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
}

/**
 * GM API 管理器
 */
export class GMAPIManager {
  private static instance: GMAPIManager;
  private scriptCache: Record<string, UserScript> = {};

  private constructor() {}

  static getInstance(): GMAPIManager {
    if (!GMAPIManager.instance) {
      GMAPIManager.instance = new GMAPIManager();
    }
    return GMAPIManager.instance;
  }

  /**
   * 处理 GM API 调用
   */
  async handleAPICall(action: string, payload: GMAPIPayload): Promise<GMAPIResponse> {
    try {
      switch (action) {
        case 'GM_setValue':
          return await this.handleGMSetValue(payload);
        case 'GM_getValue':
          return await this.handleGMGetValue(payload);
        case 'GM_getResourceText':
          return await this.handleGMGetResourceText(payload);
        case 'GM_getResourceURL':
          return await this.handleGMGetResourceURL(payload);
        case 'GM_xmlhttpRequest':
          return await this.handleGMXMLHttpRequest(payload);
        default:
          return { status: 'error', error: `Unknown GM API: ${action}` };
      }
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }

  /**
   * GM_setValue 实现
   */
  private async handleGMSetValue(payload: GMAPIPayload): Promise<GMAPIResponse> {
    const { key, value } = payload;
    if (!key) {
      return { status: 'error', error: 'Missing key parameter' };
    }

    await chrome.storage.local.set({ [key]: value });
    return { status: 'success' };
  }

  /**
   * GM_getValue 实现
   */
  private async handleGMGetValue(payload: GMAPIPayload): Promise<GMAPIResponse> {
    const { key, defaultValue } = payload;
    if (!key) {
      return { status: 'error', error: 'Missing key parameter' };
    }

    const result = await chrome.storage.local.get([key]);
    const value = result[key] === undefined ? defaultValue : result[key];
    return { status: 'success', data: value };
  }

  /**
   * GM_getResourceText 实现
   */
  private async handleGMGetResourceText(payload: GMAPIPayload): Promise<GMAPIResponse> {
    const { scriptId, resourceName } = payload;
    if (!scriptId || !resourceName) {
      return { status: 'error', error: 'Missing scriptId or resourceName parameter' };
    }

    const script = this.getScriptFromCache(scriptId);
    if (!script) {
      return { status: 'error', error: 'Script not found' };
    }

    const cacheKey = `resource_${script.id}_${resourceName}`;
    const result = await chrome.storage.local.get(cacheKey);
    
    if (result[cacheKey]) {
      return { status: 'success', data: result[cacheKey] };
    } else {
      return { status: 'error', error: `Resource not found: ${resourceName}` };
    }
  }

  /**
   * GM_getResourceURL 实现
   */
  private async handleGMGetResourceURL(payload: GMAPIPayload): Promise<GMAPIResponse> {
    const { scriptId, resourceName } = payload;
    if (!scriptId || !resourceName) {
      return { status: 'error', error: 'Missing scriptId or resourceName parameter' };
    }

    const script = this.getScriptFromCache(scriptId);
    if (!script) {
      return { status: 'error', error: 'Script not found' };
    }

    const cacheKey = `resource_${script.id}_${resourceName}`;
    const result = await chrome.storage.local.get(cacheKey);
    
    if (result[cacheKey]) {
      const blob = new Blob([result[cacheKey] as string]);
      const url = URL.createObjectURL(blob);
      return { status: 'success', data: url };
    } else {
      return { status: 'error', error: `Resource not found: ${resourceName}` };
    }
  }

  /**
   * GM_xmlhttpRequest 实现
   */
  private async handleGMXMLHttpRequest(payload: GMAPIPayload): Promise<GMAPIResponse> {
    const { scriptId, details } = payload;
    if (!scriptId || !details) {
      return { status: 'error', error: 'Missing scriptId or details parameter' };
    }

    const script = this.getScriptFromCache(scriptId);
    if (!script) {
      return { status: 'error', error: 'Script not found' };
    }

    const requestUrl = new URL(details.url);
    const isAllowed = script.meta.connect.some((domain) => 
      domain === '*' || requestUrl.hostname === domain || requestUrl.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return { 
        status: 'error', 
        error: `Domain not whitelisted in @connect: ${requestUrl.hostname}` 
      };
    }

    try {
      const response = await fetch(details.url, {
        method: details.method || 'GET',
        headers: details.headers,
        body: details.data,
      });
      
      const responseText = await response.text();
      const responseHeaders = Array.from(response.headers.entries())
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      return {
        status: 'success',
        data: { 
          responseText, 
          status: response.status, 
          statusText: response.statusText, 
          responseHeaders, 
          finalUrl: response.url 
        }
      };
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }

  /**
   * 从缓存获取脚本
   */
  private getScriptFromCache(scriptId: string): UserScript | undefined {
    return this.scriptCache[scriptId];
  }

  /**
   * 缓存脚本
   */
  cacheScript(script: UserScript): void {
    this.scriptCache[script.id] = script;
  }

  /**
   * 清除脚本缓存
   */
  clearScriptCache(scriptId?: string): void {
    if (scriptId) {
      delete this.scriptCache[scriptId];
    } else {
      this.scriptCache = {};
    }
  }

  /**
   * 批量缓存脚本
   */
  cacheScripts(scripts: UserScript[]): void {
    scripts.forEach(script => {
      this.scriptCache[script.id] = script;
    });
  }
}

// The createAPIHandler function has been removed from this file.
// The async logic is now handled directly in the background.ts message listener.