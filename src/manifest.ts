import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'CarryMonkey',
  version: '1.0.0',
  description: '一个用于管理和运行自定义JavaScript脚本的浏览器插件。',
  icons: {
    '16': 'assets/icon.png',
    '48': 'assets/icon.png',
    '128': 'assets/icon.png',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/dashboard/index.html',
  permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
  host_permissions: ["<all_urls>"],
})
