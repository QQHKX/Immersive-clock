declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Vite 环境变量类型定义
interface ImportMetaEnv {
  readonly VITE_AMAP_API_KEY: string;
  // 可以在这里添加更多环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}