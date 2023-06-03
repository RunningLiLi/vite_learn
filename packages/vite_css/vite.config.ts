import {defineConfig, normalizePath} from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import autoprefixer from 'autoprefixer';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css:{
    preprocessorOptions:{
      scss:{
        additionalData: `@import "${normalizePath(path.resolve(__dirname,"./src/variable.scss"))}";`
      }
    },
    modules: {
      // 一般我们可以通过 generateScopedName 属性来对生成的类名进行自定义
      // 其中，name 表示当前文件名，local 表示类名
      generateScopedName: "[name]__[local]__[hash:base64:5]"
    },
    postcss:{
      plugins:[autoprefixer({
        // 指定目标浏览器
        overrideBrowserslist: ["> 1%","last 2 versions"]
      })]
    },
  }
})
