/**
 * 用户指导服务
 * 为用户提供权限和配置相关的指导信息
 */

import { createComponentLogger } from './logger';
import { GuidanceEventBus } from './guidance-events';

// 创建用户指导专用日志器
const guidanceLogger = createComponentLogger('UserGuidance');

export interface GuidanceMessage {
  type: 'permission' | 'configuration' | 'browser' | 'feature';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actions?: GuidanceAction[];
  learnMoreUrl?: string;
}

export interface GuidanceAction {
  label: string;
  type: 'button' | 'link' | 'copy';
  action: string;
  primary?: boolean;
}

export interface StoredGuidanceMessage extends GuidanceMessage {
  timestamp: number;
  id: string;
}

export class UserGuidanceService {
  private static guidanceQueue: GuidanceMessage[] = [];
  private static isShowing = false;
  private static initialized = false;

  /**
   * 初始化用户指导服务
   */
  static init(): void {
    if (this.initialized) return;
    
    // 注册事件监听器
    GuidanceEventBus.on('userscripts_permission_denied', () => {
      this.addUserScriptsPermissionGuidance();
    });

    GuidanceEventBus.on('userscripts_unavailable', (event) => {
      const reason = String(event.data?.reason || 'unknown');
      this.addUserScriptsUnavailableGuidance(reason);
    });

    GuidanceEventBus.on('browser_compatibility', (event) => {
      const reason = String(event.data?.reason || 'unknown');
      this.addBrowserCompatibilityGuidance(reason);
    });

    this.initialized = true;
    guidanceLogger.debug('User guidance service initialized');
  }

  /**
   * 添加用户指导消息
   */
  static addGuidance(guidance: GuidanceMessage): void {
    this.guidanceQueue.push(guidance);
    
    guidanceLogger.info('User guidance added', {
      type: guidance.type,
      severity: guidance.severity,
      title: guidance.title,
      queueLength: this.guidanceQueue.length
    });

    // 如果当前没有显示指导，立即显示
    if (!this.isShowing) {
      this.showNextGuidance();
    }
  }

  /**
   * UserScripts 权限缺失指导
   */
  static addUserScriptsPermissionGuidance(): void {
    const extensionId = chrome.runtime.id;
    const detailsUrl = `chrome://extensions/?id=${extensionId}`;

    const guidance: GuidanceMessage = {
      type: 'permission',
      severity: 'warning',
      title: '请启用用户脚本权限',
      message: '为了让 CarryMonkey 正常运行所有脚本，您需要手动启用“允许用户脚本”权限。',
      actions: [
        {
          label: '前往设置页面',
          type: 'link', // 将由 background.ts 处理
          action: detailsUrl,
          primary: true
        },
        {
          label: '暂时忽略',
          type: 'button',
          action: 'dismiss'
        }
      ],
      learnMoreUrl: 'https://developer.chrome.com/docs/extensions/reference/api/userScripts?hl=zh-cn#availability'
    };

    this.addGuidance(guidance);
  }

  /**
   * UserScripts API 不可用指导
   */
  static addUserScriptsUnavailableGuidance(reason: string): void {
    let message = 'UserScripts API 当前不可用，CarryMonkey 将使用兼容模式。';
    let actions: GuidanceAction[] = [];

    switch (reason) {
      case 'functional_test_failed':
        message = 'UserScripts API 存在但无法正常工作。这可能是临时问题，请稍后重试。';
        actions = [
          {
            label: '重新检测',
            type: 'button',
            action: 'retry_userscripts_detection',
            primary: true
          },
          {
            label: '报告问题',
            type: 'link',
            action: 'https://github.com/hl85/carrymonkey/issues/new'
          }
        ];
        break;

      default:
        actions = [
          {
            label: '重新检测',
            type: 'button',
            action: 'retry_userscripts_detection',
            primary: true
          }
        ];
    }

    const guidance: GuidanceMessage = {
      type: 'feature',
      severity: 'warning',
      title: 'UserScripts API 不可用',
      message,
      actions,
      learnMoreUrl: 'https://github.com/hl85/carrymonkey/wiki/troubleshooting'
    };

    this.addGuidance(guidance);
  }

  /**
   * 浏览器兼容性指导
   */
  static addBrowserCompatibilityGuidance(reason = 'general'): void {
    let guidance: GuidanceMessage;

    if (reason === 'developer_mode_required') {
      guidance = {
        type: 'browser',
        severity: 'warning',
        title: '请启用开发者模式',
        message: '在旧版 Chrome 中使用 User Scripts 功能，需要先启用开发者模式。',
        actions: [
          {
            label: '打开扩展程序页面',
            type: 'link',
            action: 'chrome://extensions',
            primary: true
          }
        ],
        learnMoreUrl: 'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world?hl=zh-cn#load-unpacked'
      };
    } else {
      guidance = {
        type: 'browser',
        severity: 'info',
        title: '浏览器兼容性提示',
        message: 'CarryMonkey 在最新版本的 Chrome 浏览器上运行效果最佳。某些功能可能在旧版本中不可用。',
        actions: [
          {
            label: '检查浏览器版本',
            type: 'link',
            action: 'chrome://version/',
            primary: true
          },
          {
            label: '更新浏览器',
            type: 'link',
            action: 'chrome://settings/help'
          }
        ],
        learnMoreUrl: 'https://github.com/hl85/carrymonkey/wiki/browser-compatibility'
      };
    }

    this.addGuidance(guidance);
  }

  /**
   * 显示下一个指导消息
   */
  private static async showNextGuidance(): Promise<void> {
    if (this.guidanceQueue.length === 0 || this.isShowing) {
      return;
    }

    this.isShowing = true;
    const guidance = this.guidanceQueue.shift()!;

    guidanceLogger.info('Showing user guidance', {
      type: guidance.type,
      severity: guidance.severity,
      title: guidance.title
    });

    try {
      // 方法1: 尝试显示 Chrome 通知
      await this.showChromeNotification(guidance);
      
      // 方法2: 存储到 storage，供 popup/dashboard 读取
      await this.storeGuidanceForUI(guidance);
      
    } catch (error) {
      guidanceLogger.error('Failed to show user guidance', {
        error: (error as Error).message,
        guidance: guidance.title
      });
    }

    this.isShowing = false;

    // 显示下一个指导（如果有）
    if (this.guidanceQueue.length > 0) {
      setTimeout(() => this.showNextGuidance(), 2000); // 2秒间隔
    }
  }

  /**
   * 显示 Chrome 原生通知
   */
  private static async showChromeNotification(guidance: GuidanceMessage): Promise<void> {
    try {
      const notificationId = `carrymonkey-guidance-${Date.now()}`;
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: '/assets/icon.png',
        title: `🐒 CarryMonkey - ${guidance.title}`,
        message: guidance.message,
        buttons: guidance.actions?.slice(0, 2).map(action => ({
          title: action.label
        })) || [],
        requireInteraction: guidance.severity !== 'info' // 非信息类消息需要用户交互
      });

      // 监听通知点击
      chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
        if (notifId === notificationId && guidance.actions) {
          const action = guidance.actions[buttonIndex];
          if (action) {
            await this.handleGuidanceAction(action.action);
          }
          chrome.notifications.clear(notifId);
        }
      });

      // 监听通知本身的点击
      chrome.notifications.onClicked.addListener(async (notifId) => {
        if (notifId === notificationId) {
          // 打开 popup 或 dashboard
          await chrome.tabs.create({
            url: chrome.runtime.getURL('src/ui/dashboard/index.html')
          });
          chrome.notifications.clear(notifId);
        }
      });

      guidanceLogger.debug('Chrome notification created', {
        notificationId,
        title: guidance.title
      });

    } catch (error) {
      guidanceLogger.warn('Failed to create Chrome notification', {
        error: (error as Error).message,
        fallback: 'storing_for_ui'
      });
    }
  }

  /**
   * 存储指导消息供 UI 读取
   */
  private static async storeGuidanceForUI(guidance: GuidanceMessage): Promise<void> {
    try {
      const stored = await chrome.storage.local.get('pendingGuidance');
      const pendingGuidance: StoredGuidanceMessage[] = (stored.pendingGuidance as StoredGuidanceMessage[]) || [];
      
      pendingGuidance.push({
        ...guidance,
        timestamp: Date.now(),
        id: `guidance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });

      await chrome.storage.local.set({ pendingGuidance });

      guidanceLogger.debug('Guidance stored for UI', {
        title: guidance.title,
        totalPending: pendingGuidance.length
      });

    } catch (error) {
      guidanceLogger.error('Failed to store guidance for UI', {
        error: (error as Error).message
      });
    }
  }

  /**
   * 处理用户指导操作
   */
  static async handleGuidanceAction(action: string): Promise<void> {
    guidanceLogger.info('User guidance action triggered', {
      action
    });

    switch (action) {
      case 'enable_userscripts_permission':
        await this.requestUserScriptsPermission();
        break;
      
      case 'retry_userscripts_detection': {
        // 清除缓存并重新检测
        // 触发重新检测逻辑
        GuidanceEventBus.emit('clear_userscripts_cache');
        break;
      }

      case 'dismiss':
        // 用户选择忽略，记录但不采取行动
        guidanceLogger.info('User dismissed guidance');
        break;
      
      default:
        guidanceLogger.warn('Unknown guidance action', { action });
    }
  }

  /**
   * 请求 UserScripts 权限
   */
  private static async requestUserScriptsPermission(): Promise<void> {
    try {
      const granted = await chrome.permissions.request({
        permissions: ['userScripts']
      });

      if (granted) {
        guidanceLogger.info('UserScripts permission granted by user');
        
        // 显示成功消息
        this.addGuidance({
          type: 'permission',
          severity: 'info',
          title: '权限已启用',
          message: 'UserScripts 权限已成功启用！CarryMonkey 现在可以提供更好的脚本注入体验。',
          actions: [
            {
              label: '重新加载页面',
              type: 'button',
              action: 'reload_page',
              primary: true
            }
          ]
        });
      } else {
        guidanceLogger.warn('UserScripts permission denied by user');
        
        // 显示权限被拒绝的指导
        this.addGuidance({
          type: 'permission',
          severity: 'warning',
          title: '权限被拒绝',
          message: '您拒绝了 UserScripts 权限。CarryMonkey 将继续使用兼容模式，但某些功能可能受限。',
          actions: [
            {
              label: '稍后重试',
              type: 'button',
              action: 'enable_userscripts_permission'
            },
            {
              label: '了解影响',
              type: 'link',
              action: 'https://github.com/hl85/carrymonkey/wiki/permission-impact'
            }
          ]
        });
      }
    } catch (error) {
      guidanceLogger.error('Failed to request UserScripts permission', {
        error: (error as Error).message
      });
    }
  }

  /**
   * 获取当前指导队列状态
   */
  static getGuidanceStatus(): {
    queueLength: number;
    isShowing: boolean;
    nextGuidance?: Partial<GuidanceMessage>;
  } {
    return {
      queueLength: this.guidanceQueue.length,
      isShowing: this.isShowing,
      nextGuidance: this.guidanceQueue[0] ? {
        type: this.guidanceQueue[0].type,
        severity: this.guidanceQueue[0].severity,
        title: this.guidanceQueue[0].title
      } : undefined
    };
  }
}