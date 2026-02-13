/** CSS Modules 类型定义 */
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

/** 全局类型声明 */
declare const __ENABLE_PWA__: boolean;

/** Vite 环境变量类型定义 */
interface ImportMetaEnv {
  /** 高德地图 API Key */
  readonly VITE_AMAP_API_KEY: string;
  /** 应用版本号 */
  readonly VITE_APP_VERSION: string;
  /** 私有域主机（推荐） */
  readonly VITE_QWEATHER_API_HOST?: string;
  /** 兼容备用命名 */
  readonly VITE_QWEATHER_HOST?: string;
  /** 和风 API Key（必填） */
  readonly VITE_QWEATHER_API_KEY: string;
  /** 可选：JWT 鉴权 */
  readonly VITE_QWEATHER_JWT?: string;
}

/** 扩展 ImportMeta 接口 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
