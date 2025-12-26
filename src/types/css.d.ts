declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// 全局类型声明
declare const __ENABLE_PWA__: boolean;

// Vite 环境变量类型定义
interface ImportMetaEnv {
  readonly VITE_AMAP_API_KEY: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_QWEATHER_API_HOST?: string; // 私有域主机（推荐）
  readonly VITE_QWEATHER_HOST?: string; // 兼容备用命名
  readonly VITE_QWEATHER_API_KEY: string; // 和风 API Key（必填）
  readonly VITE_QWEATHER_JWT?: string; // 可选：JWT 鉴权
  // 可以在这里添加更多环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
