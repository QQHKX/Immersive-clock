import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { versionCachePlugin } from './src/utils/versionCache'
import fs from 'fs'
import path from 'path'

/**
 * Vite 配置文件
 * 包含开发服务器、构建优化和缓存策略配置
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 优先使用环境变量版本；否则回退到 package.json 中的版本号
  const envVersion = (env.VITE_APP_VERSION || '').trim();
  const appVersion: string = envVersion.length > 0
    ? envVersion
    : (() => {
        try {
          const pkg = JSON.parse(
            fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
          );
          return pkg.version || '0.0.0';
        } catch {
          return '0.0.0';
        }
      })();
  // 供插件（如 versionCachePlugin）读取
  process.env.VITE_APP_VERSION = appVersion;

  return {
  plugins: [
    react(),
    // PWA 插件：启用离线缓存与自动更新
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,mp3,woff2,woff}'],
        navigateFallback: '/index.html',
        // 忽略版本缓存插件添加的 v 查询参数，避免预缓存匹配失效
        ignoreURLParametersMatching: [/^v$/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'audio',
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 2 },
            },
          },
          {
            // 公告与日志 Markdown 文档离线缓存
            urlPattern: /\/docs\/.*\.md$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'docs-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
      // 复用现有 public/manifest.json
      manifest: (() => {
        try {
          const manifestRaw = fs.readFileSync(
            path.resolve(process.cwd(), 'public/manifest.json'),
            'utf-8'
          );
          const manifest = JSON.parse(manifestRaw);
          // 使用环境变量覆盖版本字段
          manifest.version = appVersion;
          return manifest;
        } catch (e) {
          return {
            name: 'Immersive Clock',
            short_name: 'Clock',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#000000',
            icons: [],
            version: appVersion,
          };
        }
      })(),
    }),
    // 版本缓存插件需在 PWA 之后运行，以便处理注入的 webmanifest
    versionCachePlugin(),
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
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
}
})