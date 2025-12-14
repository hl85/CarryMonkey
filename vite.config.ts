import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

export default defineConfig(({ mode }) => {
  // 设置构建模式环境变量
  process.env.BUILD_MODE = mode === 'compat' ? 'compat' : 'store';
  
  return {
    plugins: [
      react(),
      crx({ manifest }),
    ],
    define: {
      // 注入构建时常量
      __BUILD_MODE__: JSON.stringify(process.env.BUILD_MODE),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      outDir: mode === 'compat' ? 'dist-compat' : 'dist',
      rollupOptions: {
        output: {
          // 根据模式设置不同的输出文件名
          entryFileNames: `[name]-${mode || 'store'}.js`,
          chunkFileNames: `[name]-${mode || 'store'}.js`,
          assetFileNames: `[name]-${mode || 'store'}.[ext]`
        }
      }
    }
  };
})
