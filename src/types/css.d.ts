declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Vite 环境变量类型定义
interface ImportMetaEnv {
  readonly VITE_AMAP_API_KEY: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_QWEATHER_API_HOST?: string;
  readonly VITE_QWEATHER_HOST?: string;
  readonly VITE_QWEATHER_API_KEY?: string;
  readonly VITE_QWEATHER_JWT?: string;
  // 可以在这里添加更多环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}