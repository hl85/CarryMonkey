import { getScripts } from './storage';
import type { UserScript } from './types';

// Helper function to check if a URL matches the patterns
function isMatch(url: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Convert wildcard pattern to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(url);
  });
}

// Function to inject a script into a tab
function injectScript(tabId: number, script: UserScript) {
  chrome.scripting.executeScript(
    {
      target: { tabId },
      func: (scriptContent: string) => {
        // This function is executed in the context of the web page
        const logs: string[] = [];
        
        // 多重 nonce 检测策略
        function detectNonce() {
          const methods = [
            // 方法1: 从现有脚本标签中提取 nonce
            () => {
              const scripts = document.querySelectorAll('script[nonce]');
              if (scripts.length > 0) {
                const nonce = scripts[0].getAttribute('nonce');
                if (nonce) {
                  logs.push(`Nonce found from script tag: ${nonce}`);
                  return nonce;
                }
              }
              return null;
            },
            // 方法2: 从 meta 标签中提取 nonce
            () => {
              const metaNonce = document.querySelector('meta[property="csp-nonce"]');
              if (metaNonce) {
                const nonce = metaNonce.getAttribute('content');
                if (nonce) {
                  logs.push(`Nonce found from meta tag: ${nonce}`);
                  return nonce;
                }
              }
              return null;
            },
            // 方法3: 从 CSP 头部解析 nonce
            () => {
              const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
              if (cspMeta) {
                const csp = cspMeta.getAttribute('content');
                if (csp) {
                  const nonceMatch = csp.match(/nonce-([a-zA-Z0-9+/=]+)/);
                  if (nonceMatch) {
                    const nonce = nonceMatch[1];
                    logs.push(`Nonce found from CSP meta: ${nonce}`);
                    return nonce;
                  }
                }
              }
              return null;
            },
            // 方法3.5: 从当前页面的 CSP 错误信息中提取 nonce（特别针对微信公众号）
            () => {
              try {
                // 创建一个临时脚本来触发 CSP 违规，从而获取 nonce 信息
                const tempScript = document.createElement('script');
                tempScript.textContent = '// temp';
                
                let detectedNonce: string | null = null;
                const tempHandler = (e: SecurityPolicyViolationEvent) => {
                  const nonceMatch = e.originalPolicy.match(/'nonce-([a-zA-Z0-9+/=]+)'/);
                  if (nonceMatch) {
                    detectedNonce = nonceMatch[1];
                    logs.push(`Nonce found from CSP violation event: ${detectedNonce}`);
                  }
                };
                
                document.addEventListener('securitypolicyviolation', tempHandler);
                
                try {
                  document.head.appendChild(tempScript);
                  document.head.removeChild(tempScript);
                } catch (e) {
                  // CSP 违规是预期的
                }
                
                document.removeEventListener('securitypolicyviolation', tempHandler);
                return detectedNonce;
              } catch (e) {
                return null;
              }
            },
            // 方法4: 从页面中查找 CSP 违规报告中的 nonce
            () => {
              // 尝试从错误消息中提取 nonce
              const errorMessages: string[] = [];
              const originalConsoleError = console.error;
              console.error = function(...args: any[]) {
                errorMessages.push(args.join(' '));
                return originalConsoleError.apply(console, args);
              };
              
              // 检查是否有 CSP 违规信息包含 nonce
              const cspViolationPattern = /nonce-([a-zA-Z0-9+/=]+)/;
              for (const msg of errorMessages) {
                const match = msg.match(cspViolationPattern);
                if (match) {
                  const nonce = match[1];
                  logs.push(`Nonce found from CSP violation: ${nonce}`);
                  return nonce;
                }
              }
              
              // 恢复原始 console.error
              console.error = originalConsoleError;
              return null;
            },
            // 方法5: 从任何带有 nonce 属性的元素中提取
            () => {
              const nonceElements = document.querySelectorAll('[nonce]');
              if (nonceElements.length > 0) {
                const nonce = nonceElements[0].getAttribute('nonce');
                if (nonce) {
                  logs.push(`Nonce found from element: ${nonce}`);
                  return nonce;
                }
              }
              return null;
            }
          ];

          for (const method of methods) {
            try {
              const nonce = method();
              if (nonce) {
                return nonce;
              }
            } catch (e) {
              logs.push(`Nonce detection method failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
          }
          return null;
        }
        
        const nonce = detectNonce();
        logs.push(`Final nonce detected: ${nonce || 'No'}`);

        // 添加 CSP 违规事件监听器
        const cspViolationHandler = (e: SecurityPolicyViolationEvent) => {
          logs.push(`CSP Violation detected: ${e.violatedDirective} - ${e.blockedURI}`);
          logs.push(`Original Policy: ${e.originalPolicy}`);
          
          // 尝试从违规信息中提取 nonce
          const nonceMatch = e.originalPolicy.match(/nonce-([a-zA-Z0-9+/=]+)/);
          if (nonceMatch) {
            logs.push(`Nonce found in CSP policy: ${nonceMatch[1]}`);
          }
        };
        
        document.addEventListener('securitypolicyviolation', cspViolationHandler);

        try {
          logs.push('Attempting injection with <script> tag...');
          const scriptEl = document.createElement('script');
          if (nonce) {
            scriptEl.setAttribute('nonce', nonce);
            logs.push(`Nonce attribute set on script tag: ${nonce}`);
          } else {
            logs.push('No nonce available - proceeding without nonce attribute');
          }

          if (window.trustedTypes && window.trustedTypes.createPolicy) {
            logs.push('Trusted Types environment detected. Attempting to create policy...');
            let policy;
            try {
              policy = window.trustedTypes.createPolicy('carrymonkey-script-injector', {
                createScript: (s: string) => s,
              });
              logs.push('Policy "carrymonkey-script-injector" created successfully.');
            } catch (e) {
              if (e instanceof Error) {
                logs.push(`Policy creation failed (this is expected if it already exists): ${e.message}`);
              } else {
                logs.push('Policy creation failed with an unknown error.');
              }
              if (window.trustedTypes) {
                policy = window.trustedTypes.emptyScript;
              }
            }
            
            if (typeof policy === 'object' && 'createScript' in policy) {
              scriptEl.textContent = policy.createScript(scriptContent) as unknown as string;
              logs.push('Assigned content via TrustedScript.');
            } else {
              scriptEl.textContent = scriptContent;
              logs.push('Assigned content directly (policy was not an object).');
            }
          } else {
            logs.push('No Trusted Types. Assigning content directly.');
            scriptEl.textContent = scriptContent;
          }

          document.head.appendChild(scriptEl);
          logs.push('<script> tag appended to head.');
          scriptEl.remove();
          logs.push('<script> tag removed from head. Injection should be complete.');
        } catch (e) {
          if (e instanceof Error) {
            logs.push(`FATAL ERROR during <script> tag injection: ${e.message}`);
            logs.push(`Stack trace: ${e.stack}`);
            
            // 如果是 CSP 错误，提供更详细的诊断信息
            if (e.message.includes('Content Security Policy') || e.message.includes('CSP')) {
              logs.push('CSP-related error detected. Analyzing page CSP configuration...');
              
              // 分析页面的 CSP 配置
              const cspMetas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
              cspMetas.forEach((meta, index) => {
                const content = meta.getAttribute('content');
                logs.push(`CSP Meta ${index + 1}: ${content}`);
              });
              
              // 检查是否有 script-src 指令
              const allCSP = Array.from(cspMetas).map(meta => meta.getAttribute('content')).join(' ');
              if (allCSP.includes('script-src')) {
                logs.push('script-src directive found in CSP');
                const scriptSrcMatch = allCSP.match(/script-src[^;]*/);
                if (scriptSrcMatch) {
                  logs.push(`script-src policy: ${scriptSrcMatch[0]}`);
                }
              }
            }
          } else {
            logs.push('FATAL ERROR during <script> tag injection: An unknown error occurred.');
          }
        } finally {
          // 移除 CSP 违规事件监听器
          document.removeEventListener('securitypolicyviolation', cspViolationHandler);
        }
        
        return logs;
      },
      args: [script.content],
      world: 'MAIN',
    },
    (injectionResults) => {
      if (chrome.runtime.lastError) {
        console.error(`CarryMonkey Injection Error for script "${script.meta.name}":`, chrome.runtime.lastError.message);
      } else if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        console.log(`--- CarryMonkey Injection Log for "${script.meta.name}" ---`);
        injectionResults[0].result.forEach((log: string) => console.log(log));
        console.log('---------------------------------');
      }
    }
  );
}

// Listener for manual script execution from popup
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.action === 'executeScript') {
    injectScript(message.tabId, message.script);
  }
  sendResponse({ status: 'done' });
  return true;
});

// Listener for automatic script injection on page load
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https://'))) {
    const scripts = await getScripts();
    const enabledScripts = scripts.filter(script => script.enabled);

    for (const script of enabledScripts) {
      if (isMatch(tab.url, script.meta.match)) {
        console.log(`[Auto-Inject] Matched script "${script.meta.name}" for URL: ${tab.url}`);
        injectScript(tabId, script);
      }
    }
  }
});
