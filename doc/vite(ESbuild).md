# vite(ESbuild)

## 为什么快

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/27b3c7c8519541c1bed5601e87400409~tplv-k3u1fbpfcp-watermark.image?)

## 使用

```
pnpm i esbuild
```

使用 Esbuild 有 2 种方式，分别是 **命令行调用**和**代码调用**。

### 1.命令行调用

```
// src/index.jsx
import Server from "react-dom/server";

let Greet = () => <h1>Hello, juejin!</h1>;
console.log(Server.renderToString(<Greet />));
```

```
 "scripts": {
    "build": "./node_modules/.bin/esbuild src/index.jsx --bundle --outfile=dist/out.js"
 },
```

### 2. 代码调用

#### 项目打包——Build API

`Build API`主要用来进行项目打包，包括`build`、`buildSync`和`serve`三个方法。

1. build,buildSync(同步版本)

```
const { build, buildSync, serve } = require("esbuild");

async function runBuild() {
  // 异步方法，返回一个 Promise
  const result = await build({
    // ----  如下是一些常见的配置  ---
    // 当前项目根目录
    absWorkingDir: process.cwd(),
    // 入口文件列表，为一个数组
    entryPoints: ["./src/index.jsx"],
    // 打包产物目录
    outdir: "dist",
    // 是否需要打包，一般设为 true
    bundle: true,
    // 模块格式，包括`esm`、`commonjs`和`iife`
    format: "esm",
    // 需要排除打包的依赖列表
    external: [],
    // 是否开启自动拆包
    splitting: true,
    // 是否生成 SourceMap 文件
    sourcemap: true,
    // 是否生成打包的元信息文件
    metafile: true,
    // 是否进行代码压缩
    minify: false,
    // 是否开启 watch 模式，在 watch 模式下代码变动则会触发重新打包
    watch: false,
    // 是否将产物写入磁盘
    write: true,
    // Esbuild 内置了一系列的 loader，包括 base64、binary、css、dataurl、file、js(x)、ts(x)、text、json
    // 针对一些特殊的文件，调用不同的 loader 进行加载
    loader: {
      '.png': 'base64',
    }
  });
  console.log(result);
}

runBuild();
```

2.serve

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d0fb7b2cf904895a4cfc48e278ec750~tplv-k3u1fbpfcp-watermark.image?)

```
// build.js
const { build, buildSync, serve } = require("esbuild");

function runBuild() {
  serve(
    {
      port: 8000,
      // 静态资源目录
      servedir: './dist'
    },
    {
      absWorkingDir: process.cwd(),
      entryPoints: ["./src/index.jsx"],
      bundle: true,
      format: "esm",
      splitting: true,
      sourcemap: true,
      ignoreAnnotations: true,
      metafile: true,
    }
  ).then((server) => {
    console.log("HTTP Server starts at port", server.port);
  });
}

runBuild();
```

就是说每次刷新浏览器，会重新打包
![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/34395c49bb1e47669ae4c4d7d96194d5~tplv-k3u1fbpfcp-watermark.image?)

#### 单文件转译——Transform API

`transformSync`和`transform`

```
// transform.js
const { transform, transformSync } = require("esbuild");

async function runTransform() {
  // 第一个参数是代码字符串，第二个参数为编译配置
  const content = await transform(
    "const isNull = (str: string): boolean => str.length > 0;",
    {
      sourcemap: true,
      loader: "tsx",
    }
  );
  console.log(content);
}

runTransform();
```

## Esbuild 插件开发

```
let envPlugin = {
  name: 'env',
  setup(build) {
    build.onResolve({ filter: /^env$/ }, args => ({
      path: args.path,
      namespace: 'env-ns',
    }))

    build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
      contents: JSON.stringify(process.env),
      loader: 'json',
    }))
  },
}

require('esbuild').build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  outfile: 'out.js',
  // 应用插件
  plugins: [envPlugin],
}).catch(() => process.exit(1))
```

在不同的生命周期，选择某些文件，修改。
onResolve 返回的 namespace 用来标记文件，onLoad 可以使用来选择标记的文件。

- onResolve

```
build.onResolve({ filter: /^env$/ }, (args: onResolveArgs): onResolveResult => {
  // 模块路径
  console.log(args.path)
  // 父模块路径
  console.log(args.importer)
  // namespace 标识
  console.log(args.namespace)
  // 基准路径
  console.log(args.resolveDir)
  // 导入方式，如 import、require
  console.log(args.kind)
  // 额外绑定的插件数据
  console.log(args.pluginData)

  return {
      // 错误信息
      errors: [],
      // 是否需要 external
      external: false;
      // namespace 标识
      namespace: 'env-ns';
      // 模块路径
      path: args.path,
      // 额外绑定的插件数据
      pluginData: null,
      // 插件名称
      pluginName: 'xxx',
      // 设置为 false，如果模块没有被用到，模块代码将会在产物中会删除。否则不会这么做
      sideEffects: false,
      // 添加一些路径后缀，如`?xxx`
      suffix: '?xxx',
      // 警告信息
      warnings: [],
      // 仅仅在 Esbuild 开启 watch 模式下生效
      // 告诉 Esbuild 需要额外监听哪些文件/目录的变化
      watchDirs: [],
      watchFiles: []
  }
}
```

- onLoad

```
build.onLoad({ filter: /.*/, namespace: 'env-ns' }, (args: OnLoadArgs): OnLoadResult => {
  // 模块路径
  console.log(args.path);
  // namespace 标识
  console.log(args.namespace);
  // 后缀信息
  console.log(args.suffix);
  // 额外的插件数据
  console.log(args.pluginData);

  return {
      // 模块具体内容
      contents: '省略内容',
      // 错误信息
      errors: [],
      // 指定 loader，如`js`、`ts`、`jsx`、`tsx`、`json`等等
      loader: 'json',
      // 额外的插件数据
      pluginData: null,
      // 插件名称
      pluginName: 'xxx',
      // 基准路径
      resolveDir: './dir',
      // 警告信息
      warnings: [],
      // 同上
      watchDirs: [],
      watchFiles: []
  }
});
```

- onStart,onEnd

```
let examplePlugin = {
  name: 'example',
  setup(build) {
    build.onStart(() => {
      console.log('build started')
    });
    build.onEnd((buildResult) => {
      if (buildResult.errors.length) {
        return;
      }
      // 构建元信息
      // 获取元信息后做一些自定义的事情，比如生成 HTML
      console.log(buildResult.metafile)
    })
  },
}
```

### 实战 1: CDN 依赖拉取插件

https://github.com/RunningLiLi/vite_learn/blob/master/packages/esbuild/plugin_cdnImport.mjs

```js
import { build } from "esbuild";
import http from "http";
import https from "https";
const cdnPlugin = {
  name: "cdnPlugin",
  setup: (build) => {
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: "http-url",
    }));
    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
      console.log(args);
      return {
        // 重写路径
        path: new URL(args.path, args.importer).toString(),
        namespace: "http-url",
      };
    });
    build.onLoad({ filter: /.*/, namespace: "http-url" }, (args) => {
      return new Promise((resolve, reject) => {
        function fetch(url) {
          console.log(`Downloading: ${url}`);
          let lib = url.startsWith("https") ? https : http;
          let req = lib
            .get(url, (res) => {
              if ([301, 302, 307].includes(res.statusCode)) {
                // 重定向
                fetch(new URL(res.headers.location, url).toString());
                req.destroy();
              } else if (res.statusCode === 200) {
                // 响应成功
                let chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () =>
                  resolve({ contents: Buffer.concat(chunks) })
                );
              } else {
                reject(
                  new Error(`GET ${url} failed: status ${res.statusCode}`)
                );
              }
            })
            .on("error", reject);
        }
        fetch(args.path);
      });
    });
  },
};
build({
  absWorkingDir: process.cwd(),
  entryPoints: ["./src/index.jsx"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  splitting: true,
  sourcemap: true,
  metafile: true,
  plugins: [cdnPlugin],
}).then(() => {});
```

### 实战 2: html 自动生成

https://github.com/RunningLiLi/vite_learn/blob/master/packages/esbuild/plugins/plugin_htmlBuilder.ts

```ts
import { build, Plugin } from "esbuild";
import { cdnPlugin } from "./plugin_cdnImport";
import * as fs from "fs";
import * as path from "path";
const htmlPlugin: Plugin = {
  name: "htmlPlugin",
  setup(build) {
    build.onEnd((args) => {
      console.log(args);
      if (!args.metafile) throw new Error("请开启metafile选项");
      let scripts = Object.keys(args.metafile.outputs).reduce((pre, cur) => {
        return pre + createScript(cur.replace(/.*\//, "")) + "\n";
      }, "\n");
      let html = "";
      fs.readFile(path.resolve(__dirname, "../index.html"), (err, data) => {
        if (err) throw new Error(err.message);
        else {
          html += data.toString().replace("<body>", "<body>" + scripts);
          fs.writeFile(
            path.resolve(__dirname, "../dist/index.html"),
            html,
            () => {
              console.log("html生成完成");
            }
          );
        }
      });
    });
  },
};
function createScript(src: string): string {
  return `<script src="${src}" type="module"></script>`;
}
function createLink(href: string): string {
  return `<link href="${href}">`;
}
build({
  entryPoints: ["./src/index.jsx"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  splitting: true,
  plugins: [cdnPlugin, htmlPlugin],
  metafile: true,
});
```
