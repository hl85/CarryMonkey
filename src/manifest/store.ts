/**
 * 商店版 Manifest 配置
 * 完全符合 Chrome Web Store 规范
 */

import { baseManifest } from "./base";
import type { ManifestV3Export } from "@crxjs/vite-plugin";

export const storeManifest: ManifestV3Export = {
  ...baseManifest,

  name: "CarryMonkey",
  description: "现代化的用户脚本管理器，完全符合 Chrome Web Store 规范",

  permissions: ["activeTab", "storage", "scripting", "tabs", "userScripts"],

  minimum_chrome_version: "120",

  // 商店版特定配置
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
};
