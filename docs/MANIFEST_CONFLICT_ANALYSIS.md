# Manifest 架构冲突分析与重构报告

## 发现的问题

### ❌ 职责重复与冲突

在分析过程中，我发现了严重的 manifest 架构冲突：

1. **双重 manifest 定义**：
   - `src/core/manifest.ts` - 简单的单一配置
   - `src/manifest/` 目录 - 完整的多模式配置系统

2. **配置不一致**：
   - 路径引用不匹配
   - 权限配置重复
   - 构建目标冲突

3. **构建系统混乱**：
   - `vite.config.ts` 引用了错误的 manifest 文件
   - 缺乏统一的构建模式管理

## 重构解决方案

### ✅ 统一 Manifest 架构

#### 1. **删除冲突文件**
- 删除了 `src/core/manifest.ts`（简单版本）
- 删除了根目录的 `src/background.ts`（重复文件）
- 保留 `src/manifest/` 目录作为唯一的 manifest 管理系统

#### 2. **修复路径引用**
```typescript
// src/manifest/base.ts - 更新后
export const baseManifest = {
  background: {
    service_worker: 'src/core/background.ts', // ✅ 正确路径
    type: 'module'
  },
  action: {
    default_popup: 'src/ui/popup/index.html', // ✅ 正确路径
    default_title: 'CarryMonkey'
  },
  options_page: 'src/ui/dashboard/index.html', // ✅ 新增选项页
  icons: {
    '16': 'assets/icon.png', // ✅ 正确资源路径
    '48': 'assets/icon.png',
    '128': 'assets/icon.png'
  }
};
```

#### 3. **更新构建配置**
```typescript
// vite.config.ts - 更新后
import manifest from './src/manifest' // ✅ 指向正确的动态 manifest
```

### ✅ 完整的 Manifest 架构

#### **基础配置** (`src/manifest/base.ts`)
- 所有构建模式共享的配置
- 统一的路径引用
- 基础权限和功能

#### **商店版配置** (`src/manifest/store.ts`)
```typescript
export const storeManifest: ManifestV3Export = {
  ...baseManifest,
  name: 'CarryMonkey',
  description: '现代化的用户脚本管理器，完全符合 Chrome Web Store 规范',
  minimum_chrome_version: '120',
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';" // ✅ 严格 CSP
  }
};
```

#### **兼容版配置** (`src/manifest/compat.ts`)
```typescript
export const compatManifest: ManifestV3Export = {
  ...baseManifest,
  name: 'CarryMonkey (Enhanced)',
  description: '增强版用户脚本管理器，包含最大兼容性功能',
  minimum_chrome_version: '88',
  content_security_policy: {
    extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self';" // ✅ 兼容 CSP
  }
};
```

#### **动态导出** (`src/manifest/index.ts`)
```typescript
// 根据构建模式自动选择配置
const buildMode = process.env.BUILD_MODE || 'store';
export default buildMode === 'compat' ? compatManifest : storeManifest;
```

## 架构优势

### 1. **职责清晰分离**
- **base.ts**: 共享配置，避免重复
- **store.ts**: 商店版特定配置
- **compat.ts**: 兼容版特定配置
- **index.ts**: 动态选择逻辑

### 2. **构建模式支持**
```bash
pnpm buildc  # 兼容版构建 → 使用 compatManifest
pnpm builds  # 商店版构建 → 使用 storeManifest
```

### 3. **配置一致性**
- 统一的路径引用
- 一致的权限配置
- 清晰的 CSP 策略

### 4. **可维护性**
- 单一数据源原则
- 配置变更只需修改一处
- 类型安全的配置管理

## 验证结果

### ✅ 构建测试通过
- **兼容版构建** (`pnpm buildc`): ✅ 成功
- **商店版构建** (`pnpm builds`): ✅ 成功
- 生成正确的 manifest.json 文件
- 路径引用全部正确

### ✅ 配置差异验证
```json
// 商店版 manifest.json
{
  "name": "CarryMonkey",
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },
  "minimum_chrome_version": "120"
}

// 兼容版 manifest.json  
{
  "name": "CarryMonkey (Enhanced)",
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self';"
  },
  "minimum_chrome_version": "88"
}
```

## 解决的冲突

### 1. **消除重复定义**
- 删除了 `src/core/manifest.ts` 的重复配置
- 统一使用 `src/manifest/` 系统

### 2. **修复路径冲突**
- 更新了所有文件路径引用
- 确保构建系统正确找到资源

### 3. **统一权限管理**
- 集中管理扩展权限
- 避免权限配置不一致

### 4. **CSP 策略分离**
- 商店版：严格的 CSP 策略
- 兼容版：宽松的 CSP 策略（支持 eval）

## 总结

通过这次重构，我们：

1. **✅ 消除了 manifest 配置的重复和冲突**
2. **✅ 建立了清晰的多模式构建架构**
3. **✅ 确保了配置的一致性和可维护性**
4. **✅ 验证了构建系统的正确性**

现在的 manifest 架构完全符合单一职责原则，没有重复或冲突，为不同的构建目标提供了清晰、可维护的配置管理方案。