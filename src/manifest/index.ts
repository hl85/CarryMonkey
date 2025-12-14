/**
 * 动态 Manifest 导出
 * 根据构建模式选择合适的 manifest 配置
 */

import { storeManifest } from './store';
import { compatManifest } from './compat';

// 获取构建模式
const buildMode = process.env.BUILD_MODE || 'store';

// 根据模式导出对应的 manifest
export default buildMode === 'compat' ? compatManifest : storeManifest;