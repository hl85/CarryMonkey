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
          logs.push('Starting nonce detection...');
          
          // 方法1: 从现有脚本标签中提取 nonce
          logs.push('Method 1: Checking script tags...');
          const scripts = document.querySelectorAll('script[nonce]');
          logs.push(`Found ${scripts.length} script tags with nonce attribute`);
          if (scripts.length > 0) {
            const nonce = scripts[0].getAttribute('nonce');
            logs.push(`First script nonce value: "${nonce}"`);
            if (nonce) {
              logs.push(`Nonce found from script tag: ${nonce}`);
              return nonce;
            } else {
              logs.push('First script nonce attribute is empty or null');
              // 尝试检查其他脚本标签
              for (let i = 0; i < Math.min(scripts.length, 5); i++) {
                const scriptNonce = scripts[i].getAttribute('nonce');
                logs.push(`Script ${i} nonce: "${scriptNonce}"`);
                if (scriptNonce) {
                  logs.push(`Nonce found from script tag ${i}: ${scriptNonce}`);
                  return scriptNonce;
                }
              }
            }
          }
          
          // 方法2: 从 meta 标签中提取 nonce
          logs.push('Method 2: Checking meta tags...');
          const metaNonce = document.querySelector('meta[property="csp-nonce"]');
          if (metaNonce) {
            const nonce = metaNonce.getAttribute('content');
            if (nonce) {
              logs.push(`Nonce found from meta tag: ${nonce}`);
              return nonce;
            }
          } else {
            logs.push('No meta[property="csp-nonce"] found');
          }
          
          // 方法3: 从 CSP 头部解析 nonce
          logs.push('Method 3: Checking CSP meta tags...');
          const cspMetas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
          logs.push(`Found ${cspMetas.length} CSP meta tags`);
          for (const cspMeta of cspMetas) {
            const csp = cspMeta.getAttribute('content');
            if (csp) {
              logs.push(`CSP content: ${csp}`);
              const nonceMatch = csp.match(/nonce-([a-zA-Z0-9+/=]+)/);
              if (nonceMatch) {
                const nonce = nonceMatch[1];
                logs.push(`Nonce found from CSP meta: ${nonce}`);
                return nonce;
              }
            }
          }
          
          // 方法4: 从页面的 HTTP 响应头或内联 CSP 中提取 nonce
          logs.push('Method 4: Checking page source and inline CSP...');
          try {
            // 尝试从页面源码中查找 CSP 策略
            const htmlContent = document.documentElement.outerHTML;
            const cspMatches = htmlContent.match(/script-src[^"']*'nonce-([a-zA-Z0-9+/=]+)'/g);
            if (cspMatches) {
              for (const match of cspMatches) {
                const nonceMatch = match.match(/'nonce-([a-zA-Z0-9+/=]+)'/);
                if (nonceMatch) {
                  const nonce = nonceMatch[1];
                  logs.push(`Nonce found from page source CSP: ${nonce}`);
                  return nonce;
                }
              }
            }
            
            // 尝试从错误消息中提取（检查控制台历史）
            const errorPattern = /nonce-([a-zA-Z0-9+/=]+)/;
            if (window.console && window.console.error) {
              // 创建一个临时的违规来触发错误
              const tempScript = document.createElement('script');
              tempScript.textContent = '// trigger CSP';
              
              let cspError: string | null = null;
              const originalError = window.console.error;
              window.console.error = function(...args: unknown[]) {
                const errorMsg = String(args.join(' '));
                if (errorMsg.includes('Content Security Policy') && errorMsg.includes('nonce-')) {
                  cspError = errorMsg;
                  logs.push(`CSP error captured: ${errorMsg}`);
                }
                return originalError.apply(window.console, args);
              };
              
              try {
                document.head.appendChild(tempScript);
                document.head.removeChild(tempScript);
              } catch {
                // Expected CSP violation
              }
              window.console.error = originalError;
              
              let err = '';
              if (cspError && typeof cspError === 'string') {
                err = cspError;
                const nonceMatch = err.match(errorPattern);
                if (nonceMatch) {
                  const nonce = nonceMatch[1];
                  logs.push(`Nonce extracted from CSP error: ${nonce}`);
                  return nonce;
                }
              }
            }
          } catch (e) {
            logs.push(`Method 4 failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
          
          // 方法4.5: 使用 Promise 和异步方式触发 CSP 违规
          logs.push('Method 4.5: Async CSP violation detection...');
          try {
            let asyncDetectedNonce: string | null = null;
            
            const asyncHandler = (e: SecurityPolicyViolationEvent) => {
              logs.push(`Async CSP violation: ${e.violatedDirective}`);
              logs.push(`Async original policy: ${e.originalPolicy}`);
              const nonceMatch = e.originalPolicy.match(/'nonce-([a-zA-Z0-9+/=]+)'/);
              if (nonceMatch) {
                asyncDetectedNonce = nonceMatch[1];
                logs.push(`Async nonce extracted: ${asyncDetectedNonce}`);
              }
            };
            
            document.addEventListener('securitypolicyviolation', asyncHandler);
            
            // 使用 setTimeout 来异步触发
            setTimeout(() => {
              try {
                const asyncScript = document.createElement('script');
                asyncScript.textContent = 'console.log("async test");';
                document.head.appendChild(asyncScript);
                document.head.removeChild(asyncScript);
              } catch {
                // Expected
              }
            }, 0);
            
            // 等待一小段时间让事件触发
            const startTime = Date.now();
            while (Date.now() - startTime < 50 && !asyncDetectedNonce) {
              // 短暂等待
            }
            
            document.removeEventListener('securitypolicyviolation', asyncHandler);
            
            if (asyncDetectedNonce) {
              return asyncDetectedNonce;
            }
          } catch (error) {
            logs.push(`Method 4.5 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          
          // 方法5: 从任何带有 nonce 属性的元素中提取
          logs.push('Method 5: Checking all elements with nonce...');
          const nonceElements = document.querySelectorAll('[nonce]');
          logs.push(`Found ${nonceElements.length} elements with nonce attribute`);
          if (nonceElements.length > 0) {
            // 检查前几个元素的 nonce 值
            for (let i = 0; i < Math.min(nonceElements.length, 10); i++) {
              const element = nonceElements[i];
              const nonce = element.getAttribute('nonce');
              logs.push(`Element ${i} (${element.tagName}) nonce: "${nonce}"`);
              if (nonce && nonce.trim()) {
                logs.push(`Nonce found from element ${i}: ${nonce}`);
                return nonce;
              }
            }
            logs.push('All checked elements have empty or null nonce values');
          }
          
          logs.push('All nonce detection methods failed');
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
