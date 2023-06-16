# ESM 高阶特性

## import map

- 绝对路径，如 `https://cdn.skypack.dev/react`
- 相对路径，如`./module-a`
- `bare import`即直接写一个第三方包名，如`react`、`lodash`
  浏览器默认不支持 bare import
  import map 就是来解决这个问题的

```
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>

<body>
  <div id="root"></div>
  <script type="importmap">
  {
    "imports": {
      "react": "https://cdn.skypack.dev/react"
    }
  }
  </script>

  <script type="module">
    import React from 'react';
    console.log(React)
  </script>
</body>

</html>
```

### 兼容性

它只能兼容市面上 `68%` 左右的浏览器份额，而反观`type="module"`的兼容性(兼容 95% 以上的浏览器)，`import map`的兼容性实属不太乐观

### 相应的 polyfill

[es-module-shims](https://link.juejin.cn?target=https%3A%2F%2Fgithub.com%2Fguybedford%2Fes-module-shims "https://github.com/guybedford/es-module-shims")

1.  `dynamic import`。即动态导入，部分老版本的 Firefox 和 Edge 不支持。
1.  `import.meta`和`import.meta.url`。当前模块的元信息，类似 Node.js 中的 `__dirname`、`__filename`。
1.  `modulepreload`。以前我们会在 link 标签中加上 `rel="preload"` 来进行资源预加载，即在浏览器解析 HTML 之前就开始加载资源，现在对于 ESM 也有对应的`modulepreload`来支持这个行为。
1.  `JSON Modules`和 `CSS Modules`，即通过如下方式来引入`json`或者`css`:

## Nodejs 包导出策略

在 Node.js 中(`>=12.20 版本`)有一般如下几种方式可以使用原生 ES Module:

- 文件以 `.mjs` 结尾；
- package.json 中声明`type: "module"`。

### main 字段

```
"main": "./dist/index.js"
```

### exports 字段

```
// package.json
{
  "name": "package-a",
  "type": "module",
  "exports": {
    // 默认导出，使用方式: import a from 'package-a'
    ".": "./dist/index.js",
    // 子路径导出，使用方式: import d from 'package-a/dist'
    "./dist": "./dist/index.js",
    "./dist/*": "./dist/*", // 这里可以使用 `*` 导出目录下所有的文件
    // 条件导出，区分 ESM 和 CommonJS 引入的情况
    "./main": {
      "import": "./main.js",
      "require": "./main.cjs"
    },
  }
}
```

#### 条件导出常见属性

- `node`: 在 Node.js 环境下适用，可以定义为嵌套条件导出，如:

```

```

```
{
  "exports": {
    {
      ".": {
       "node": {
         "import": "./main.js",
         "require": "./main.cjs"
        }
      }
    }
  },
}
```

- `import`: 用于 import 方式导入的情况，如`import("package-a")`;
- `require`: 用于 require 方式导入的情况，如`require("package-a")`;
- `default`，兜底方案，如果前面的条件都没命中，则使用 default 导出的路径。
  > 当然，条件导出还包含 `types`、`browser`、`develoment`、`production` 等属性，大家可以参考 Node.js 的[详情文档](https://link.juejin.cn?target=https%3A%2F%2Fnodejs.org%2Fapi%2Fpackages.html%23conditional-exports "https://nodejs.org/api/packages.html#conditional-exports")

## Nodejs 包导入策略

### import 字段

```
{
  "imports": {
    // key 一般以 # 开头
    // 也可以直接赋值为一个字符串: "#dep": "lodash-es"
    "#dep": {
      "node": "lodash-es",
      "default": "./dep-polyfill.js"
    },
  },
  "dependencies": {
    "lodash-es": "^4.17.21"
  }
}
```

使用

```
// index.js
import { cloneDeep } from "#dep";

const obj = { a: 1 };

// { a: 1 }
console.log(cloneDeep(obj));
```

Node.js 在执行的时候会将`#dep`定位到`lodash-es`这个第三方包，当然，你也可以将其定位到某个内部文件。这样相当于实现了`路径别名`的功能，不过与构建工具中的 `alias` 功能不同的是，"imports" 中声明的别名必须全量匹配，否则 Node.js 会直接抛错。

## Pure ESM

### 概念

首先，什么是 `Pure ESM` ? `Pure ESM` 最初是在 Github 上的一个[帖子](https://link.juejin.cn?target=https%3A%2F%2Fgist.github.com%2Fsindresorhus%2Fa39789f98801d908bbc7ff3ecc99d99c "https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c")中被提出来的，其中有两层含义，一个是让 npm 包都提供 ESM 格式的产物，另一个是仅留下 ESM 产物，抛弃 CommonJS 等其它格式产物。
同时也有一部分的 npm 包做得更加激进，直接采取`Pure ESM`模式，如大名鼎鼎的`chalk`和`imagemin`

> 对于没有上层封装需求的大型框架，如 Nuxt、Umi，在保证能上 `Pure ESM`的情况下，直接上不会有什么问题；但如果是一个底层基础库，最好提供好 ESM 和 CommonJS 两种格式的产物。

### ESM 和 Commonjs 的兼容性

#### ESM<-CommonJS

在 ESM 中，我们可以直接导入 CommonJS 模块，如:

```
// react 仅有 CommonJS 产物
import React from 'react';
console.log(React)
```

#### CommonJS<-ES

Node.js 执行以上的原生 ESM 代码并没有问题，但反过来，如果你想在 CommonJS 中 require 一个 ES 模块，就行不通了:

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a2eb7f6511084a58a77aab5e2ff65f57~tplv-k3u1fbpfcp-watermark.image?)

可以通过动态导入在 commonjs 引入 ES 模块

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1ce75ce29dce40b9b8550c5295d4b805~tplv-k3u1fbpfcp-watermark.image?)

- 1.  如果执行环境不支持异步，CommonJS 将无法导入 ES 模块；
- 2.  jest 中不支持导入 ES 模块，测试会比较困难；
- 3.  在 tsc 中，对于 `await import()`语法会强制编译成 `require`的语法([详情](https://link.juejin.cn?target=https%3A%2F%2Fgithub.com%2Fmicrosoft%2FTypeScript%2Fissues%2F43329 "https://github.com/microsoft/TypeScript/issues/43329"))，只能靠`eval('await import()')`绕过去。

#### 总结

总而言之，CommonJS 中导入 ES 模块比较困难。因此，如果一个基础底层库使用 `Pure ESM`，那么潜台词相当于你依赖这个库时(可能是直接依赖，也有可能是间接依赖)，你自己的库/应用的产物最好为 `ESM` 格式。也就是说，`Pure ESM`是具有传染性的，底层的库出现了 Pure ESM 产物，那么上层的使用方也最好是 Pure ESM，否则会有上述的种种限制。

但从另一个角度来看，对于大型框架(如 Nuxt)而言，基本没有二次封装的需求，框架本身如果能够使用 Pure ESM ，那么也能带动社区更多的包(比如框架插件)走向 Pure ESM，同时也没有上游调用方的限制，反而对社区 ESM 规范的推动是一件好事情。

### 新一代的基础库打包器

当然，上述的结论也带来了一个潜在的问题: 大型框架毕竟很有限，npm 上大部分的包还是属于基础库的范畴，那对于大部分包，我们采用导出 ESM/CommonJS 两种产物的方案，会不会对项目的语法产生限制呢？
我们知道，在 ESM 中无法使用 CommonJS 中的 `__dirname`、`__filename`、`require.resolve` 等全局变量和方法，同样的，在 CommonJS 中我们也没办法使用 ESM 专有的 `import.meta`对象，那么如果要提供两种产物格式，这些模块规范相关的语法怎么处理呢？

在传统的编译构建工具中，我们很难逃开这个问题，但新一代的基础库打包器`tsup`给了我们解决方案。

- ESM 和 CommonJS 双格式的产物，并且可以任意使用与模块格式强相关的一些全局变量或者 API

```
export interface Options {
  data: string;
}

export function init(options: Options) {
  console.log(options);
  console.log(import.meta.url);
}
```

将会转换成

```
var getImportMetaUrl = () =>
  typeof document === "undefined"
    ? new URL("file:" + __filename).href
    : (document.currentScript && document.currentScript.src) ||
      new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/index.ts
function init(options) {
  console.log(options);
  console.log(importMetaUrl);
}
```
