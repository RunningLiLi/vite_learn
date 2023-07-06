# no-bundle构建工具（上）
1.  首先，我们会进行开发环境的搭建，安装必要的依赖，并搭建项目的构建脚本，同时完成 cli 工具的初始化代码。
2.  然后我们正式开始实现`依赖预构建`的功能，通过 Esbuild 实现依赖扫描和依赖构建的功能。
3.  接着开始搭建 Vite 的插件机制，也就是开发 `PluginContainer` 和 `PluginContext` 两个主要的对象。
4.  搭建完插件机制之后，我们将会开发一系列的插件来实现 no-bundle 服务的编译构建能力，包括入口 HTML 处理、 TS/TSX/JS/TSX 编译、CSS 编译和静态资源处理。
5.  最后，我们会实现一套系统化的模块热更新的能力，从搭建模块依赖图开始，逐步实现 HMR 服务端和客户端的开发

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/35c2ba4c157342969db9a5348e77fc8a~tplv-k3u1fbpfcp-watermark.image?)

## 搭建开发环境

start就是修改后tsup实时打包
```js
"scripts": {
    "start": "tsup --watch",
    "build": "tsup --minify"
},

```
```js
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  // 后续会增加 entry
  entry: {
    index: "src/node/cli.ts",
  },
  // 产物格式，包含 esm 和 cjs 格式
  format: ["esm", "cjs"],
  // 目标语法
  target: "es2020",
  // 生成 sourcemap
  sourcemap: true,
  // 没有拆包的需求，关闭拆包能力
  splitting: false,
});

```
脚手架入口
```js
// src/node/cli.ts
import cac from "cac";

const cli = cac();

// [] 中的内容为可选参数，也就是说仅输入 `vite` 命令下会执行下面的逻辑
cli
  .command("[root]", "Run the development server")
  .alias("serve")
  .alias("dev")
  .action(async () => {
    console.log('测试 cli~');
  });

cli.help();
cli.parse();
```
构建bin目录
```js
#!/usr/bin/env node

require("../dist/index.js");
```
当别的项目引入我们的包时，会自动在node_modules文件夹下的.bin添加mini-vite文件
```js
{
  "bin": {
    "mini-vite": "bin/mini-vite"
  }
}
```
### 小结
> 当我们修改了我们的mini-vite源码时，tsup自动监听并打包输出到dist文件夹，playground项目文件夹，把我们的mini-vite项目，当作依赖引入，所以package.json的bin字段自动添加到了node_modules文件夹下的.bin,所以在playground项目下直接通过pnpm run mini-vite可以运行我们的脚手架，进行开发。

## 依赖预构建
-   确定预构建入口
-   从入口开始扫描出用到的依赖
-   对依赖进行预构建

先完成预构建的扫描依赖功能
```ts
// src/node/optimizer/scanPlugin.ts
import { Plugin } from "esbuild";
import { BARE_IMPORT_RE, EXTERNAL_TYPES } from "../constants";

export function scanPlugin(deps: Set<string>): Plugin {
  return {
    name: "esbuild:scan-deps",
    setup(build) {
      // 忽略的文件类型
      build.onResolve(
        { filter: new RegExp(`\\.(${EXTERNAL_TYPES.join("|")})$`) },
        (resolveInfo) => {
          return {
            path: resolveInfo.path,
            // 打上 external 标记
            external: true,
          };
        }
      );
      // 记录依赖
      build.onResolve(
        {
          filter: BARE_IMPORT_RE,
        },
        (resolveInfo) => {
          const { path: id } = resolveInfo;
          // 推入 deps 集合中
          deps.add(id);
          return {
            path: id,
            external: true,
          };
        }
      );
    },
  };
}
```
然后是正式打包依赖

```ts
import { Loader, Plugin } from "esbuild";
import { BARE_IMPORT_RE } from "../constants";
// 用来分析 es 模块 import/export 语句的库
import { init, parse } from "es-module-lexer";
import path from "path";
// 一个实现了 node 路径解析算法的库
import resolve from "resolve";
// 一个更加好用的文件操作库
import fs from "fs-extra";
// 用来开发打印 debug 日志的库
import createDebug from "debug";
import { normalizePath } from "../utils";

const debug = createDebug("dev");

export function preBundlePlugin(deps: Set<string>): Plugin {
  return {
    name: "esbuild:pre-bundle",
    setup(build) {
      build.onResolve(
        {
          filter: BARE_IMPORT_RE,
        },
        (resolveInfo) => {
          const { path: id, importer } = resolveInfo;
          const isEntry = !importer;
          // 命中需要预编译的依赖
          if (deps.has(id)) {
            // 若为入口，则标记 dep 的 namespace
            return isEntry
              ? {
                  path: id,
                  namespace: "dep",
                }
              : {
                  // 因为走到 onResolve 了，所以这里的 path 就是绝对路径了
                  path: resolve.sync(id, { basedir: process.cwd() }),
                };
          }
        }
      );

      // 拿到标记后的依赖，构造代理模块，交给 esbuild 打包
      build.onLoad(
        {
          filter: /.*/,
          namespace: "dep",
        },
        async (loadInfo) => {
          await init;
          const id = loadInfo.path;
          const root = process.cwd();
          const entryPath = normalizePath(resolve.sync(id, { basedir: root }));
          const code = await fs.readFile(entryPath, "utf-8");
          const [imports, exports] = await parse(code);
          let proxyModule = [];
          // cjs
          if (!imports.length && !exports.length) {
            // 构造代理模块
            // 下面的代码后面会解释
            const res = require(entryPath);
            const specifiers = Object.keys(res);
            proxyModule.push(
              `export { ${specifiers.join(",")} } from "${entryPath}"`,
              `export default require("${entryPath}")`
            );
          } else {
            // esm 格式比较好处理，export * 或者 export default 即可
            if (exports.includes("default")) {
              proxyModule.push(`import d from "${entryPath}";export default d`);
            }
            proxyModule.push(`export * from "${entryPath}"`);
          }
          debug("代理模块内容: %o", proxyModule.join("\n"));
          const loader = path.extname(entryPath).slice(1);
          return {
            loader: loader as Loader,
            contents: proxyModule.join("\n"),
            resolveDir: root,
          };
        }
      );
    },
  };
}
```
### 小结
- 大概思路是先通过**scanPlugin**插件获取需要预构建的依赖
得到`Set(3) { 'react-dom', 'react/jsx-runtime', 'react' }`

- 然后通过**preBundlePlugin**插件根据上面获取的set进行预构建（就是通过esbuild.build将依赖分别打包到node_modules下）。
## 插件机制开发


```ts
// src/node/pluginContainer.ts
// 模拟 Rollup 的插件机制
export const createPluginContainer = (plugins: Plugin[]): PluginContainer => {
  // 插件上下文对象
  // @ts-ignore 这里仅实现上下文对象的 resolve 方法
  class Context implements RollupPluginContext {
    async resolve(id: string, importer?: string) {
      let out = await pluginContainer.resolveId(id, importer);
      if (typeof out === "string") out = { id: out };
      return out as ResolvedId | null;
    }
  }
  // 插件容器
  const pluginContainer: PluginContainer = {
    async resolveId(id: string, importer?: string) {
      const ctx = new Context() as any;
      for (const plugin of plugins) {
        if (plugin.resolveId) {
          const newId = await plugin.resolveId.call(ctx as any, id, importer);
          if (newId) {
            id = typeof newId === "string" ? newId : newId.id;
            return { id };
          }
        }
      }
      return null;
    },
    async load(id) {
      const ctx = new Context() as any;
      for (const plugin of plugins) {
        if (plugin.load) {
          const result = await plugin.load.call(ctx, id);
          if (result) {
            return result;
          }
        }
      }
      return null;
    },
    async transform(code, id) {
      const ctx = new Context() as any;
      for (const plugin of plugins) {
        if (plugin.transform) {
          const result = await plugin.transform.call(ctx, code, id);
          if (!result) continue;
          if (typeof result === "string") {
            code = result;
          } else if (result.code) {
            code = result.code;
          }
        }
      }
      return { code };
    },
  };

  return pluginContainer;
};

```


```diff
// src/node/server/index.ts
import connect from "connect";
import { blue, green } from "picocolors";
import { optimize } from "../optimizer/index";
+ import { resolvePlugins } from "../plugins";
+ import { createPluginContainer, PluginContainer } from "../pluginContainer";

export interface ServerContext {
+  root: string;
+  pluginContainer: PluginContainer;
+  app: connect.Server;
+  plugins: Plugin[];
}

export async function startDevServer() {
  const app = connect();
  const root = process.cwd();
  const startTime = Date.now();
+  const plugins = resolvePlugins();
+  const pluginContainer = createPluginContainer(plugins);

+  const serverContext: ServerContext = {
+    root: process.cwd(),
+    app,
+    pluginContainer,
+    plugins,
+  };

+  for (const plugin of plugins) {
+    if (plugin.configureServer) {
+      await plugin.configureServer(serverContext);
+    }
+  }

  app.listen(3000, async () => {
    await optimize(root);
    console.log(
      green("🚀 No-Bundle 服务已经成功启动!"),
      `耗时: ${Date.now() - startTime}ms`
    );
    console.log(`> 本地访问路径: ${blue("http://localhost:3000")}`);
  });
}

```
### 小结
- 启动服务器时，获取有效插件，根据插件通过createPluginContainer创建插件容器
>（{resolveId,load,transform}每个方法会调用所有插件的相应钩子，钩子也可以通过this访问到插件容器上下文调用resolveId等方法）

- 创建服务器时正是configServer钩子的调用时机

```diff
+ for (const plugin of plugins) { 
+    if (plugin.configureServer) { 
+       await plugin.configureServer(serverContext); 
+     } 
+ }
```
- 服务器启动后，开始预构建


## 入口 HTML 加载

添加服务器中间件

```ts
import { NextHandleFunction } from "connect";
import { ServerContext } from "../index";
import path from "path";
import { pathExists, readFile } from "fs-extra";

export function indexHtmlMiddware(
  serverContext: ServerContext
): NextHandleFunction {
  return async (req, res, next) => {
    if (req.url === "/") {
      const { root } = serverContext;
      // 默认使用项目根目录下的 index.html
      const indexHtmlPath = path.join(root, "index.html");
      if (await pathExists(indexHtmlPath)) {
        const rawHtml = await readFile(indexHtmlPath, "utf8");
        let html = rawHtml;
        // 通过执行插件的 transformIndexHtml 方法来对 HTML 进行自定义的修改
        for (const plugin of serverContext.plugins) {
          if (plugin.transformIndexHtml) {
            html = await plugin.transformIndexHtml(html);
          }
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        return res.end(html);
      }
    }
    return next();
  };
}
```
### 小结
当收到请求路径为`/`时，就要返回root下的index.html，并调用所有插件的`transformIndexHtml`钩子对index.html做转换后返回


## JS/TS/JSX/TSX 编译能力

首先新增一个中间件`src/node/server/middlewares/transform.ts`，内容如下:

```ts
import { NextHandleFunction } from "connect";
import {
  isJSRequest,
  cleanUrl,
} from "../../utils";
import { ServerContext } from "../index";
import createDebug from "debug";

const debug = createDebug("dev");

export async function transformRequest(
  url: string,
  serverContext: ServerContext
) {
  const { pluginContainer } = serverContext;
  url = cleanUrl(url);
  // 简单来说，就是依次调用插件容器的 resolveId、load、transform 方法
  const resolvedResult = await pluginContainer.resolveId(url);
  let transformResult;
  if (resolvedResult?.id) {
    let code = await pluginContainer.load(resolvedResult.id);
    if (typeof code === "object" && code !== null) {
      code = code.code;
    }
    if (code) {
      transformResult = await pluginContainer.transform(
        code as string,
        resolvedResult?.id
      );
    }
  }
  return transformResult;
}

export function transformMiddleware(
  serverContext: ServerContext
): NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== "GET" || !req.url) {
      return next();
    }
    const url = req.url;
    debug("transformMiddleware: %s", url);
    // transform JS request
    if (isJSRequest(url)) {
      // 核心编译函数
      let result = await transformRequest(url, serverContext);
      if (!result) {
        return next();
      }
      if (result && typeof result !== "string") {
        result = result.code;
      }
      // 编译完成，返回响应给浏览器
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript");
      return res.end(result);
    }

    next();
  };
}
```
### 小结
- 添加中间件，拦截所有js，jsx,tsx,ts请求，依次调用resolvedId，load，transform等钩子进行转换后再返回给浏览器。


## 内置插件
### 1. 路径解析插件
当浏览器向我们的本地服务器发起请求时

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ad21d66f6efa46ea86c8cd399cdfb9d6~tplv-k3u1fbpfcp-watermark.image?)

我们需要根据路径，解析成文件真正的路径，比如`D：/xx/src/main.tsx`

```ts
import resolve from "resolve";
import { Plugin } from "../plugin";
import { ServerContext } from "../server/index";
import path from "path";
import { pathExists } from "fs-extra";
import { DEFAULT_EXTERSIONS } from "../constants";
import { cleanUrl, normalizePath } from "../utils";

export function resolvePlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: "m-vite:resolve",
    configureServer(s) {
      // 保存服务端上下文
      serverContext = s;
    },
    async resolveId(id: string, importer?: string) {
      // 1. 绝对路径
      if (path.isAbsolute(id)) {
        if (await pathExists(id)) {
          return { id };
        }
        // 加上 root 路径前缀，处理 /src/main.tsx 的情况
        id = path.join(serverContext.root, id);
        if (await pathExists(id)) {
          return { id };
        }
      }
      // 2. 相对路径
      else if (id.startsWith(".")) {
        if (!importer) {
          throw new Error("`importer` should not be undefined");
        }
        const hasExtension = path.extname(id).length > 1;
        let resolvedId: string;
        // 2.1 包含文件名后缀
        // 如 ./App.tsx
        if (hasExtension) {
          resolvedId = normalizePath(resolve.sync(id, { basedir: path.dirname(importer) }));
          if (await pathExists(resolvedId)) {
            return { id: resolvedId };
          }
        } 
        // 2.2 不包含文件名后缀
        // 如 ./App
        else {
          // ./App -> ./App.tsx
          for (const extname of DEFAULT_EXTERSIONS) {
            try {
              const withExtension = `${id}${extname}`;
              resolvedId = normalizePath(resolve.sync(withExtension, {
                basedir: path.dirname(importer),
              }));
              if (await pathExists(resolvedId)) {
                return { id: resolvedId };
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
      return null;
    },
  };
}

```
### 2. Esbuild 语法编译插件
将 JS/TS/JSX/TSX 编译成浏览器可以识别的 JS 语法
```ts
import { readFile } from "fs-extra";
import { Plugin } from "../plugin";
import { isJSRequest } from "../utils";
import esbuild from "esbuild";
import path from "path";

export function esbuildTransformPlugin(): Plugin {
  return {
    name: "m-vite:esbuild-transform",
    // 加载模块
    async load(id) {
      if (isJSRequest(id)) {
        try {
          const code = await readFile(id, "utf-8");
          return code;
        } catch (e) {
          return null;
        }
      }
    },
    async transform(code, id) {
      if (isJSRequest(id)) {
        const extname = path.extname(id).slice(1);
        const { code: transformedCode, map } = await esbuild.transform(code, {
          target: "esnext",
          format: "esm",
          sourcemap: true,
          loader: extname as "js" | "ts" | "jsx" | "tsx",
        });
        return {
          code: transformedCode,
          map,
        };
      }
      return null;
    },
  };
}

```
### 3. import 分析插件
返回的文件中的import语句我们需要改写
比如在

```js
//src/main.tsx
import App from "./App.tsx"
```
需要转换成
```js
//src/main.tsx
import App from "/src/App.tsx"
```
**import的路径是不支持以盘符开头的**
-   对于第三方依赖路径(bare import)，需要重写为预构建产物路径；
-   对于绝对路径和相对路径，需要借助之前的路径解析插件进行解析。

```ts
// 新建 src/node/plugins/importAnalysis.ts
import { init, parse } from "es-module-lexer";
import {
  BARE_IMPORT_RE,
  DEFAULT_EXTERSIONS,
  PRE_BUNDLE_DIR,
} from "../constants";
import {
  cleanUrl,
  isJSRequest,
  normalizePath
} from "../utils";
// magic-string 用来作字符串编辑
import MagicString from "magic-string";
import path from "path";
import { Plugin } from "../plugin";
import { ServerContext } from "../server/index";
import { pathExists } from "fs-extra";
import resolve from "resolve";

export function importAnalysisPlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: "m-vite:import-analysis",
    configureServer(s) {
      // 保存服务端上下文
      serverContext = s;
    },
    async transform(code: string, id: string) {
      // 只处理 JS 相关的请求
      if (!isJSRequest(id)) {
        return null;
      }
      await init;
      // 解析 import 语句
      const [imports] = parse(code);
      const ms = new MagicString(code);
      // 对每一个 import 语句依次进行分析
      for (const importInfo of imports) {
        // 举例说明: const str = `import React from 'react'`
        // str.slice(s, e) => 'react'
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource) continue;
        // 第三方库: 路径重写到预构建产物的路径
        if (BARE_IMPORT_RE.test(modSource)) {
           const bundlePath = normalizePath(
            path.join('/', PRE_BUNDLE_DIR, `${modSource}.js`)
          );
          ms.overwrite(modStart, modEnd, bundlePath);
        } else if (modSource.startsWith(".") || modSource.startsWith("/")) {
          // 直接调用插件上下文的 resolve 方法，会自动经过路径解析插件的处理
          const resolved = await this.resolve(modSource, id);
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolved.id);
          }
        }
      }

      return {
        code: ms.toString(),
        // 生成 SourceMap
        map: ms.generateMap(),
      };
    },
  };
}

```
### 小结
对3个插件的作用是对每一个请求
1. 先找到文件真正的路径（resolve插件）（注意外部依赖需要使用预构建后的路径）
2. 对文件进行编译（esbuild编译插件）
3. 对文件的import路径进行改写（import分析插件）

## 总结

1. 开启本地服务器时，解析配置文件，获取所有插件
2. 通过createPluginContainer创建插件容器
3. 组合服务器上下文对象，方便各个中间件处理
4. 此时正是`configureServer`的调用时机
5. 加入 `indexHtmlMiddware`中间件，完成的功能就是path=/时，读取index.html返回（这个时候正是`transformIndexHtml`的调用时机）
6. 加入 `transformMiddleware`中间件，处理其他请求，对于每一个请求，都通过resolve钩子找到真正路径，通过load加载文件，通过这3个步骤返回
    - 先找到文件真正的路径（resolve插件）
    - 对文件进行编译（esbuild编译插件）
    - 对文件的import路径进行改写（import分析插件）
7. 返回给浏览器，浏览器又通过import语句发起请求，递归重复第6步，完成所有文件的解析
```ts
// src/node/server/index.ts
import connect from "connect";
import { blue, green } from "picocolors";
import { optimize } from "../optimizer";
import { Plugin } from "../plugin";
import { resolvePlugins } from "../plugins";
import { createPluginContainer, PluginContainer } from "../pluginContainer";
import { indexHtmlMiddware } from "./middlewares/indexHtml";
import { transformMiddleware } from "./middlewares/transform";
export interface ServerContext {
  root: string;
  pluginContainer: PluginContainer;
  app: connect.Server;
  plugins: Plugin[];
}

export async function startDevServer() {
  const app = connect();
  const root = process.cwd();
  const startTime = Date.now();
  const plugins = resolvePlugins();
  const pluginContainer = createPluginContainer(plugins);

  const serverContext: ServerContext = {
    root: process.cwd(),
    app,
    pluginContainer,
    plugins,
  };

  for (const plugin of plugins) {
    if (plugin.configureServer) {
      await plugin.configureServer(serverContext);
    }
  }
  app.use(indexHtmlMiddware(serverContext));
  app.use(transformMiddleware(serverContext));

  app.listen(3000, async () => {
    await optimize(root);
    console.log(
      green("🚀 No-Bundle 服务已经成功启动!"),
      `耗时: ${Date.now() - startTime}ms`
    );
    console.log(`> 本地访问路径: ${blue("http://localhost:3000")}`);
  });
}

```















