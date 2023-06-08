import { defineConfig } from "vite";
import inspect from "vite-plugin-inspect";
import react from "@vitejs/plugin-react-swc";
import virtual_module from "./plugins/virtual_module";
import viteSvgrPlugin from "./plugins/svgr";
// import viteSvgr from "vite-plugin-svgr";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    virtual_module(),
    inspect(),
    viteSvgrPlugin({ defaultExport: "url" }),
    // viteSvgr(),
  ],
});
