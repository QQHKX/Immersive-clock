/**
 * 版本缓存控制插件
 * 根据 package.json / 环境变量版本号生成查询参数
 * 当版本更新时，确保关键资源（manifest、webmanifest、favicon）刷新
 */
import fs from "fs";
import path from "path";

import { Plugin } from "vite";

/**
 * 创建版本缓存控制插件
 * @returns Vite插件
 */
export function versionCachePlugin(): Plugin {
  let version: string;

  return {
    name: "version-cache-plugin",
    configResolved() {
      // 优先使用环境变量中的版本号（由 vite.config 注入）
      const envVersion = process.env.VITE_APP_VERSION;
      if (envVersion && envVersion.trim().length > 0) {
        version = envVersion;
        return;
      }
      // 回退：读取 package.json 中的版本号
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
        );
        version = packageJson.version;
      } catch (error) {
        console.error("读取版本失败:", error);
        version = Date.now().toString(); // 如果读取失败，使用时间戳作为版本号
      }
    },
    transformIndexHtml(html) {
      // JS/CSS 使用构建产物哈希进行缓存刷新；仅为关键文件添加版本参数
      return (
        html
          // 为manifest.json添加版本号
          .replace(/(href=("|')[^"']*manifest\.json)("|')/g, `$1?v=${version}$3`)
          // 为webmanifest添加版本号
          .replace(/(href=("|')[^"']*\.webmanifest)("|')/g, `$1?v=${version}$3`)
          // 为favicon.svg添加版本号
          .replace(/(href=("|')[^"']*favicon\.svg)("|')/g, `$1?v=${version}$3`)
      );
    },
  };
}
