# vite（痛点/ESM/0-1/css 工程化）

## 痛点

1. 模块化
2. 兼容性（新语法，ts，css 预处理器）
3. 生产性能问题
4. 开发效率
   ![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ba54a6bd1bc74f3c8818d99e83516360~tplv-k3u1fbpfcp-watermark.image?)

### 模块化

1. 通过按顺序引入 script 标签
2. 命名空间

```ts
// module-a.js
window.moduleA = {
  data: "moduleA",
  method: function () {
    console.log("execute A's method");
  },
};
```

3. IIFE

#### 规范

1. commonJS(require)
2. AMD(define)
3. SeaJS
   > UMD 满足 AMD 和 commonJS（跨平台）

4.ESM

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c802a6e05e014e5496ec1492bac6ee4f~tplv-k3u1fbpfcp-watermark.image?)

> 跨平台

## vite（0-1）

```shell
pnpm create vite
```

```bash
.
├── index.html
├── package.json
├── pnpm-lock.yaml
├── src
│   ├── App.css
│   ├── App.tsx
│   ├── favicon.svg
│   ├── index.css
│   ├── logo.svg
│   ├── main.tsx
│   └── vite-env.d.ts
├── tsconfig.json
└── vite.config.ts
```

> 访问 localhost 请求 index.html，劫持文件，处理后（ts->js,less->css 等）再返回；返回后执行文件中的 import，
> 一个 import 就是一个 http 请求，相当于递归请求所有必要文件

### 配置

```
// vite.config.ts
import { defineConfig } from 'vite'
// 引入 path 包注意两点:
// 1. 为避免类型报错，你需要通过 `pnpm i @types/node -D` 安装类型
// 2. tsconfig.node.json 中设置 `allowSyntheticDefaultImports: true`，以允许下面的 default 导入方式
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 手动指定项目根目录位置
  root: path.join(__dirname, 'src')
  plugins: [react()]
})
```

### 打包

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d8d9f6b34bc946ecae0c18790be7838d~tplv-k3u1fbpfcp-watermark.image?)

虽然 Vite 提供了开箱即用的 TypeScript 以及 JSX 的编译能力，但实际上底层并没有实现 TypeScript 的类型校验系统，因此需要借助 `tsc` 来完成类型校验(在 Vue 项目中使用 `vue-tsc` 这个工具来完成)，在打包前提早暴露出类型相关的问题，保证代码的健壮性

## 现代 css 工程化

### 痛点

1. 开发效率（不支持嵌套等）
2. 样式污染
3. 浏览器兼容
4. 代码体积

### 方案

1. css 预处理器
2. css MOdule
3. css 后处理器 PostCSS
4. CSS in JS
5. CSS 原子化框架

### vite/css 配置

1. 配置自动注入 scss 变量

```ts
// vite.config.ts
import { normalizePath } from "vite";
// 如果类型报错，需要安装 @types/node: pnpm i @types/node -D
import path from "path";

// 全局 scss 文件的路径
// 用 normalizePath 解决 window 下的路径问题
const variablePath = normalizePath(path.resolve("./src/variable.scss"));

export default defineConfig({
  // css 相关的配置
  css: {
    preprocessorOptions: {
      scss: {
        // additionalData 的内容会在每个 scss 文件的开头自动注入
        additionalData: `@import "${variablePath}";`,
      },
    },
  },
});
```

2. CSS Modules

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3b4730ed78384e37b0c8319be04ec437~tplv-k3u1fbpfcp-watermark.image?)

3. PostCSS

```
// vite.config.ts 增加如下的配置
import autoprefixer from 'autoprefixer';

export default {
 css: {
   // 进行 PostCSS 配置
   postcss: {
     plugins: [
       autoprefixer({
         // 指定目标浏览器
         overrideBrowserslist: ['Chrome > 40', 'ff > 31', 'ie 11']
       })
     ]
   }
 }
}
```

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6ce22691ab604056b9bb56c819f93148~tplv-k3u1fbpfcp-watermark.image?)

4. CSS In JS

```
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        // 加入 babel 插件
        // 以下插件包都需要提前安装
        // 当然，通过这个配置你也可以添加其它的 Babel 插件
        plugins: [
          // 适配 styled-component
          "babel-plugin-styled-components"
          // 适配 emotion
          "@emotion/babel-plugin"
        ]
      },
      // 注意: 对于 emotion，需要单独加上这个配置
      // 通过 `@emotion/react` 包编译 emotion 中的特殊 jsx 语法
      jsxImportSource: "@emotion/react"
    })
  ]
})
```

5. CSS 原子化框架

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e84e3739ca834b1bb4f2ed298b6de643~tplv-k3u1fbpfcp-watermark.image?)
除了本身的原子化 CSS 能力，Windi CSS 还有一些非常好用的高级功能，在此我给大家推荐自己常用的两个能力: **attributify** 和 **shortcuts**。

```jsx
<button
  bg="blue-400 hover:blue-500 dark:blue-500 dark:hover:blue-600"
  text="sm white"
  font="mono light"
  p="y-2 x-4"
  border="2 rounded blue-200"
>
  Button
</button>
```

```jsx
<div className="flex-c"></div>
<!-- 等同于下面这段 -->
<div className="flex justify-center items-center"></div>
```

Tailwind 配置
