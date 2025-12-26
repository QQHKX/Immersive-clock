import fs from "fs";
import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

import { versionCachePlugin } from "./src/utils/versionCache";

/**
 * Vite 配置文件
 * 包含开发服务器、构建优化和缓存策略配置
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // 检测是否为 Electron 模式
  const isElectron = mode === 'electron';
  
  console.log('Vite Mode:', mode);
  console.log('Is Electron:', isElectron);
  
  // 优先使用环境变量版本；否则回退到 package.json 中的版本号
  const envVersion = (env.VITE_APP_VERSION || "").trim();
  const appVersion: string =
    envVersion.length > 0
      ? envVersion
      : (() => {
          try {
            const pkg = JSON.parse(
              fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
            );
            return pkg.version || "0.0.0";
          } catch {
            return "0.0.0";
          }
        })();
  // 供插件（如 versionCachePlugin）读取
  process.env.VITE_APP_VERSION = appVersion;

  return {
    plugins: [
      react(),
      // Electron 插件（仅在 Electron 模式下启用）
      isElectron && electron([
        {
          // 主进程入口文件
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        },
        {
          // 预加载脚本
          entry: 'electron/preload.ts',
          onstart(options) {
            // 重新加载页面
            options.reload();
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
                // 将预加载脚本输出为 CommonJS，以避免在打包后的 preload 中出现 ESM import
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].cjs',
                },
              }
            }
          }
        }
      ]),
      isElectron && renderer(),
      // PWA 插件：启用离线缓存与自动更新
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "apple-touch-icon.png", "og-image.png"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,mp3,woff2,woff}"],
          navigateFallback: "/index.html",
          // 扩大离线导航覆盖范围，匹配所有同源路径
          navigateFallbackAllowlist: [/^\/.*$/],
          // 防止静态文件（如 sitemap.xml、robots.txt 等）被导航回退到 SPA
          navigateFallbackDenylist: [
            /\.(xml|txt|webmanifest|json|ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|eot|ttf|otf)$/,
          ],
          // 忽略版本缓存插件添加的 v 查询参数，避免预缓存匹配失效
          ignoreURLParametersMatching: [/^v$/],
          runtimeCaching: [
            {
              // 缓存本地字体文件（内置自托管）
              urlPattern: /\/fonts\/.*\.(woff2?|ttf|otf|eot)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "local-webfonts",
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "font",
              handler: "CacheFirst",
              options: {
                cacheName: "fonts-cache",
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "audio",
              handler: "CacheFirst",
              options: {
                cacheName: "audio-cache",
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 2 },
              },
            },
            {
              // 公告与日志 Markdown 文档离线缓存
              urlPattern: /\/docs\/.*\.md$/,
              handler: "NetworkFirst",
              options: {
                cacheName: "docs-cache",
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
              path.resolve(process.cwd(), "public/manifest.json"),
              "utf-8"
            );
            const manifest = JSON.parse(manifestRaw);
            // 使用环境变量覆盖版本字段
            manifest.version = appVersion;
            return manifest;
          } catch (e) {
            return {
              name: "Immersive Clock",
              short_name: "Clock",
              start_url: "/",
              display: "standalone",
              background_color: "#ffffff",
              theme_color: "#000000",
              icons: [],
              version: appVersion,
            };
          }
        })(),
      }),
      // 版本缓存插件需在 PWA 之后运行，以便处理注入的 webmanifest
      versionCachePlugin(),
    ].filter(Boolean),
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "__ENABLE_PWA__": !isElectron,
    },
    base: isElectron ? './' : '/',
    server: {
      port: 3005,
      open: !isElectron,
      // 开发服务器缓存配置
      headers: {
        "Cache-Control": "no-cache",
      },
    },
    build: {
      outDir: "dist",
      sourcemap: process.env.NODE_ENV !== "production" ? true : false,
      // 资源内联阈值
      assetsInlineLimit: 4096,
      // 代码分割配置
      rollupOptions: {
        output: {
          // 静态资源文件名配置
          assetFileNames: (assetInfo) => {
            // 根据文件类型设置不同的文件名模式
            if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name)) {
              return "fonts/[name]-[hash][extname]";
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
              return "images/[name]-[hash][extname]";
            }
            if (/\.(mp3|wav|ogg|m4a)$/i.test(assetInfo.name)) {
              return "audio/[name]-[hash][extname]";
            }

            return "assets/[name]-[hash][extname]";
          },
          // JS 文件分割
          chunkFileNames: "js/[name]-[hash].js",
          entryFileNames: "js/[name]-[hash].js",
        },
      },
      // 压缩配置
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === "production",
          drop_debugger: process.env.NODE_ENV === "production",
        },
      },
    },
  };
});
