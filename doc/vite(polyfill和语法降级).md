# vite(polyfill 和语法降级)

兼容低版本浏览器

## 底层工具链

### 工具概览

- **编译时工具**。代表工具有`@babel/preset-env`和`@babel/plugin-transform-runtime`。
- **运行时基础库**。代表库包括`core-js`和`regenerator-runtime`。
  **编译时工具**的作用是在代码编译阶段进行**语法降级**及**添加 `polyfill` 代码的引用语句**，如:

```
import "core-js/modules/es6.set.js"
```

而**运行时基础库**是根据 `ESMAScript`官方语言规范提供各种`Polyfill`实现代码，主要包括`core-js`和`regenerator-runtime`两个基础库，不过在 babel 中也会有一些上层的封装，包括：

- [@babel/polyfill](https://link.juejin.cn?target=https%3A%2F%2Fbabeljs.io%2Fdocs%2Fen%2Fbabel-polyfill "https://babeljs.io/docs/en/babel-polyfill")
- [@babel/runtime](https://link.juejin.cn?target=https%3A%2F%2Fbabeljs.io%2Fdocs%2Fen%2Fbabel-runtime "https://babeljs.io/docs/en/babel-runtime")
- [@babel/runtime-corejs2](https://link.juejin.cn?target=https%3A%2F%2Fbabeljs.io%2Fdocs%2Fen%2Fbabel-runtime-corejs2 "https://babeljs.io/docs/en/babel-runtime-corejs2")
- [@babel/runtime-corejs3](https://link.juejin.cn?target=https%3A%2F%2Fbabeljs.io%2Fdocs%2Fen%2Fbabel-runtime-corejs3 "https://babeljs.io/docs/en/babel-runtime-corejs3") 看似各种运行时库眼花缭乱，其实都是`core-js`和`regenerator-runtime`不同版本的封装罢了(`@babel/runtime`是个特例，不包含 core-js 的 Polyfill)。这类库是项目运行时必须要使用到的，因此一定要放到`package.json`中的`dependencies`中！

## @babel/preset-env 使用

```
pnpm i @babel/cli @babel/core @babel/preset-env
```

```
const func = async () => {
  console.log(12123)
}

Promise.resolve().finally();
```

```
//`.babelrc.json`
{
  "presets": [
    [
      "@babel/preset-env",
      {
        // 指定兼容的浏览器版本
        "targets": {
          "ie": "11"
        },
        // 基础库 core-js 的版本，一般指定为最新的大版本
        "corejs": 3,
        // Polyfill 注入策略，后文详细介绍
        "useBuiltIns": "usage",
        // 不将 ES 模块语法转换为其他模块语法
        "modules": false
      }
    ]
  ]
}
```

```
//Browserslist写法
{
  // ie 不低于 11 版本，全球超过 0.5% 使用，且还在维护更新的浏览器
  "targets": "ie >= 11, > 0.5%, not dead"
}
```

最佳实践

```
// 现代浏览器
last 2 versions and since 2018 and > 0.5%
// 兼容低版本 PC 浏览器
IE >= 11, > 0.5%, not dead
// 兼容低版本移动端浏览器
iOS >= 9, Android >= 4.4, last 2 versions, > 0.2%, not dead
```

### `useBuiltIns`

- entry

- usage

### 更优的 Polyfill 注入方案: transform-runtime

> 需要提前说明的是，`transform-runtime`方案可以作为`@babel/preset-env`中`useBuiltIns`配置的替代品，也就是说，一旦使用`transform-runtime`方案，你应该把`useBuiltIns`属性设为 `false`。

```
pnpm i @babel/plugin-transform-runtime -D
pnpm i @babel/runtime-corejs3 -S
```

```
{
  "plugins": [
    // 添加 transform-runtime 插件
    [
      "@babel/plugin-transform-runtime",
      {
        "corejs": 3
      }
    ]
  ],
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "ie": "11"
        },
        "corejs": 3,
        // 关闭 @babel/preset-env 默认的 Polyfill 注入
        "useBuiltIns": false,
        "modules": false
      }
    ]
  ]
}
```

## Vite 语法降级与 Polyfill 注入

个插件内部同样使用 `@babel/preset-env` 以及 `core-js`等一系列基础库来进行语法降级和 Polyfill 注入

```
pnpm i @vitejs/plugin-legacy -D
```

```
// vite.config.ts
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // 省略其它插件
    legacy({
      // 设置目标浏览器，browserslist 配置语法
      targets: ['ie >= 11'],
    })
  ]
})
```

## 完美方案

还有一个方案，就是在线 cdn 引入
