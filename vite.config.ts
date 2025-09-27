import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { versionCachePlugin } from './src/utils/versionCache'

/**
 * Vite 配置文件
 * 包含开发服务器、构建优化和缓存策略配置
 */
export default defineConfig({
  plugins: [react(), versionCachePlugin()],
  server: {
    port: 3005,
    open: true,
    // 开发服务器缓存配置
    headers: {
      'Cache-Control': 'no-cache'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production' ? true : false,
    // 资源内联阈值
    assetsInlineLimit: 4096,
    // 代码分割配置
    rollupOptions: {
      output: {
        // 静态资源文件名配置
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          
          // 根据文件类型设置不同的文件名模式
          if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return 'fonts/[name]-[hash][extname]'
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return 'images/[name]-[hash][extname]'
          }
          if (/\.(mp3|wav|ogg|m4a)$/i.test(assetInfo.name)) {
            return 'audio/[name]-[hash][extname]'
          }
          
          return 'assets/[name]-[hash][extname]'
        },
        // JS 文件分割
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  }
})