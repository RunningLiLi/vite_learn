/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
  readonly VITE_BASE_URL: string;
  // 自定义的环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
