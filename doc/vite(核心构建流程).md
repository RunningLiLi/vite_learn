# vite(核心编译流程)

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/47a30825dc234d6295e8d83e4c8c6338~tplv-k3u1fbpfcp-watermark.image?)

## 插件容器

- 在生产环境中 Vite 直接调用 Rollup 进行打包，所以 Rollup 可以调度各种插件；
- 在开发环境中，Vite 模拟了 Rollup 的插件机制，设计了一个`PluginContainer` 对象来调度各个插件。

`PluginContainer` 的 [实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fmain%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fserver%2FpluginContainer.ts "https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/pluginContainer.ts") 基于借鉴于 WMR 中的`rollup-plugin-container.js`，主要分为 2 个部分:

1. 实现 Rollup 插件钩子的调度
2. 实现插件钩子内部的 Context 上下文对象

```js
const container = {
  // 异步串行钩子
  options: await (async () => {
    let options = rollupOptions
    for (const plugin of plugins) {
      if (!plugin.options) continue
      options =
        (await plugin.options.call(minimalContext, options)) || options
    }
    return options;
  })(),
  // 异步并行钩子
  async buildStart() {
    await Promise.all(
      plugins.map((plugin) => {
        if (plugin.buildStart) {
          return plugin.buildStart.call(
            new Context(plugin) as any,
            container.options as NormalizedInputOptions
          )
        }
      })
    )
  },
  // 异步优先钩子
  async resolveId(rawId, importer) {
    // 上下文对象，后文介绍
    const ctx = new Context()

    let id: string | null = null
    const partial: Partial<PartialResolvedId> = {}
    for (const plugin of plugins) {
      const result = await plugin.resolveId.call(
        ctx as any,
        rawId,
        importer,
        { ssr }
      )
      if (!result) continue;
      return result;
    }
  }
  // 异步优先钩子
  async load(id, options) {
    const ctx = new Context()
    for (const plugin of plugins) {
      const result = await plugin.load.call(ctx as any, id, { ssr })
      if (result != null) {
        return result
      }
    }
    return null
  },
  // 异步串行钩子
  async transform(code, id, options) {
    const ssr = options?.ssr
    // 每次 transform 调度过程会有专门的上下文对象，用于合并 SourceMap，后文会介绍
    const ctx = new TransformContext(id, code, inMap as SourceMap)
    ctx.ssr = !!ssr
    for (const plugin of plugins) {
      let result: TransformResult | string | undefined
      try {
        result = await plugin.transform.call(ctx as any, code, id, { ssr })
      } catch (e) {
        ctx.error(e)
      }
      if (!result) continue;
      // 省略 SourceMap 合并的逻辑 
      code = result;
    }
    return {
      code,
      map: ctx._getCombinedSourcemap()
    }
  },
  // close 钩子实现省略
}

```

context对象

>包含所有钩子中可以通过this.xxx()调用的方法

```ts
import { RollupPluginContext } from 'rollup';
type PluginContext = Omit<
  RollupPluginContext,
  // not documented
  | 'cache'
  // deprecated
  | 'emitAsset'
  | 'emitChunk'
  | 'getAssetFileName'
  | 'getChunkFileName'
  | 'isExternal'
  | 'moduleIds'
  | 'resolveId'
  | 'load'
>

const watchFiles = new Set<string>()

class Context implements PluginContext {
  // 实现各种上下文方法
  // 解析模块 AST(调用 acorn)
  parse(code: string, opts: any = {}) {
    return parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      ...opts
    })
  }
  // 解析模块路径
  async resolve(
    id: string,
    importer?: string,
    options?: { skipSelf?: boolean }
  ) {
    let skip: Set<Plugin> | undefined
    if (options?.skipSelf && this._activePlugin) {
      skip = new Set(this._resolveSkips)
      skip.add(this._activePlugin)
    }
    let out = await container.resolveId(id, importer, { skip, ssr: this.ssr })
    if (typeof out === 'string') out = { id: out }
    return out as ResolvedId | null
  }

  // 以下两个方法均从 Vite 的模块依赖图中获取相关的信息
  // 我们将在下一节详细介绍模块依赖图，本节不做展开
  getModuleInfo(id: string) {
    return getModuleInfo(id)
  }

  getModuleIds() {
    return moduleGraph
      ? moduleGraph.idToModuleMap.keys()
      : Array.prototype[Symbol.iterator]()
  }
  
  // 记录开发阶段 watch 的文件
  addWatchFile(id: string) {
    watchFiles.add(id)
    ;(this._addedImports || (this._addedImports = new Set())).add(id)
    if (watcher) ensureWatchedFile(watcher, id, root)
  }

  getWatchFiles() {
    return [...watchFiles]
  }
  
  warn() {
    // 打印 warning 信息
  }
  
  error() {
    // 打印 error 信息
  }
  
  // 其它方法只是声明，并没有具体实现，这里就省略了
}

```

## 插件工作流概览

将所有插件根据执行时机依次放入数组并返回
> filter返回值为flase和不属于当前工作模式的插件

```js
export async function resolvePlugins(
  config: ResolvedConfig,
  prePlugins: Plugin[],
  normalPlugins: Plugin[],
  postPlugins: Plugin[]
): Promise<Plugin[]> {
  const isBuild = config.command === 'build'
  // 收集生产环境构建的插件，后文会介绍
  const buildPlugins = isBuild
    ? (await import('../build')).resolveBuildPlugins(config)
    : { pre: [], post: [] }

  return [
    // 1. 别名插件
    isBuild ? null : preAliasPlugin(),
    aliasPlugin({ entries: config.resolve.alias }),
    // 2. 用户自定义 pre 插件(带有`enforce: "pre"`属性)
    ...prePlugins,
    // 3. Vite 核心构建插件
    // 数量比较多，暂时省略代码
    // 4. 用户插件（不带有 `enforce` 属性）
    ...normalPlugins,
    // 5. Vite 生产环境插件 & 用户插件(带有 `enforce: "post"`属性)
    definePlugin(config),
    cssPostPlugin(config),
    ...buildPlugins.pre,
    ...postPlugins,
    ...buildPlugins.post,
    // 6. 一些开发阶段特有的插件
    ...(isBuild
      ? []
      : [clientInjectionsPlugin(config), importAnalysisPlugin(config)])
  ].filter(Boolean) as Plugin[]
}

```

然后类似这样调用

```js
// call configResolved hooks await Promise.all(userPlugins.map((p) => p.configResolved?.(resolved)))
```

从上述代码中我们可以总结出 Vite 插件的具体执行顺序。

1. **别名插件**包括 `vite:pre-alias`和`@rollup/plugin-alias`，用于路径别名替换。
2. 用户自定义 pre 插件，也就是带有`enforce: "pre"`属性的自定义插件。
3. Vite 核心构建插件，这部分插件为 Vite 的核心编译插件，数量比较多，我们在下部分一一拆解。
4. 用户自定义的普通插件，即不带有 `enforce` 属性的自定义插件。
5. `Vite 生产环境插件`和用户插件中带有`enforce: "post"`属性的插件。
6. 一些开发阶段特有的插件，包括环境变量注入插件`clientInjectionsPlugin`和 import 语句分析及重写插件`importAnalysisPlugin`。

## 插件功能梳理

除用户自定义插件之外，我们需要梳理的 Vite 内置插件有下面这几类:

- 别名插件
- 核心构建插件
- 生产环境特有插件
- 开发环境特有插件

### 1.别名插件

别名插件有两个，分别是 [vite:pre-alias](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F72cb33e947e7aa72d27ed0c5eacb2457d523dfbf%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2FpreAlias.ts "https://github.com/vitejs/vite/blob/72cb33e947e7aa72d27ed0c5eacb2457d523dfbf/packages/vite/src/node/plugins/preAlias.ts") 和 [@rollup/plugin-alias](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F72cb33e947e7aa72d27ed0c5eacb2457d523dfbf%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Findex.ts%23L3 "https://github.com/vitejs/vite/blob/72cb33e947e7aa72d27ed0c5eacb2457d523dfbf/packages/vite/src/node/plugins/index.ts#L3")。 前者主要是为了将 bare import 路径重定向到预构建依赖的路径，如:

```ts
// 假设 React 已经过 Vite 预构建
import React from 'react';
// 会被重定向到预构建产物的路径
import React from '/node_modules/.vite/react.js'
```

后者则是实现了比较通用的路径别名(即`resolve.alias`配置)的功能，使用的是 [Rollup 官方 Alias 插件](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Frollup%2Fplugins%2Ftree%2Fmaster%2Fpackages%2Falias%23rollupplugin-alias "https://github.com/rollup/plugins/tree/master/packages/alias#rollupplugin-alias")。

### 2. 核心构建插件

#### 2.1 module preload 特性的 Polyfill

```js
{
  build: {
    polyfillModulePreload: true； //开启
  }
}
```

#### 2.2 路径解析插件

#### 2.3 内联脚本加载插件

```ts
const htmlProxyRE = /\?html-proxy&index=(\d+)\.js$/

export function htmlInlineScriptProxyPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite:html-inline-script-proxy',
    load(id) {
      const proxyMatch = id.match(htmlProxyRE)
      if (proxyMatch) {
        const index = Number(proxyMatch[1])
        const file = cleanUrl(id)
        const url = file.replace(normalizePath(config.root), '')
        // 内联脚本的内容会被记录在 htmlProxyMap 这个表中
        const result = htmlProxyMap.get(config)!.get(url)![index]
        if (typeof result === 'string') {
          // 加载脚本的具体内容
          return result
        } else {
          throw new Error(`No matching HTML proxy module found from ${id}`)
        }
      }
    }
  }
}


```

#### 2.4 CSS 编译插件

即名为`vite:css`的[插件](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fcss.ts%23L137 "https://github.com/vitejs/vite/blob/2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0/packages/vite/src/node/plugins/css.ts#L137")，主要实现下面这些功能:

- `CSS 预处理器的编译`
- `CSS Modules`
- `Postcss 编译`
- 通过 @import `记录依赖`，便于 HMR

#### 2.5 Esbuild 转译插件

即名为`vite:esbuild`的[插件](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fesbuild.ts "https://github.com/vitejs/vite/blob/2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0/packages/vite/src/node/plugins/esbuild.ts")，用来进行 `.js`、`.ts`、`.jsx`和`tsx`，代替了传统的 Babel 或者 TSC 的功能，

```js
import { transformWithEsbuild } from 'vite';

// 传入两个参数: code, filename
transformWithEsbuild('<h1>hello</h1>', './index.tsx').then(res => {
  // {
  //   warnings: [],
  //   code: '/* @__PURE__ */ React.createElement("h1", null, "hello");\n',
  //   map: {/* sourcemap 信息 */}
  // }
  console.log(res);
})

```

#### 2.6 静态资源加载插件

静态资源加载插件包括如下几个:

- **vite:json** 用来加载 JSON 文件，通过`@rollup/pluginutils`的`dataToEsm`方法可实现 JSON 的按名导入，具体实现见[链接](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fjson.ts%23L30 "https://github.com/vitejs/vite/blob/2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0/packages/vite/src/node/plugins/json.ts#L30")；
- **vite:wasm** 用来加载 `.wasm` 格式的文件，具体实现见[链接](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fwasm.ts%23L45 "https://github.com/vitejs/vite/blob/2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0/packages/vite/src/node/plugins/wasm.ts#L45")；
- **vite:worker** 用来 Web Worker 脚本，插件内部会使用 Rollup 对 Worker 脚本进行打包，具体实现见[链接](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2F2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fworker.ts "https://github.com/vitejs/vite/blob/2b7e836f84b56b5f3dc81e0f5f161a9b5f9154c0/packages/vite/src/node/plugins/worker.ts")；
- **vite:asset**，开发阶段实现了其他格式静态资源的加载，而生产环境会通过 `renderChunk` 钩子将静态资源地址重写为产物的文件地址，如`./img.png` 重写为 `https://cdn.xxx.com/assets/img.91ee297e.png`。

### 3. 生产环境特有插件

#### 3.1 全局变量替换插件

提供全局变量替换功能，如下面的这个配置:

```
ts
复制代码
// vite.config.ts
const version = '2.0.0';

export default {
  define: {
    __APP_VERSION__: `JSON.stringify(${version})`
  }
}
```

- 开发环境下，Vite 会通过将所有的全局变量挂载到`window`对象，而不用经过 define 插件的处理，节省编译开销；
- 生产环境下，Vite 会使用 [define 插件](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fmain%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fdefine.ts "https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/define.ts")，进行字符串替换以及 sourcemap 生成。

#### 3.2 CSS 后处理插件

CSS 后处理插件即`name`为`vite:css-post`的插件，它的功能包括`开发阶段 CSS 响应结果处理`和`生产环境 CSS 文件生成`。

生产环境中，Vite 默认会通过这个插件进行 CSS 的 code splitting，即对于每个异步 chunk，Vite 会将其依赖的 CSS 代码单独打包成一个文件

最后，插件会调用 Esbuild 对 CSS 进行压缩

#### 3.3 HTML 构建插件

**个人总结：**
![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8e4d80498b684d2f955130e75bb14afd~tplv-k3u1fbpfcp-watermark.image?)

解析成大概这样

```js
//entryChunk.js
import ".src/main.tsx"
import "xxxx"
```

如果 `entryChunk.js`只有import，打包html时，将所有的import转换成script标签，并且删除entryChunk.js
![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2776f9c31e024b81abeded66dbc5ff33~tplv-k3u1fbpfcp-watermark.image?)

如果 `entryChunk.js`不只有import，打包后的html,将所有的import转换成`<link rel="modulepreload>`标签,但是不完全删除entryChunk.js，而是将其中的import删除，将entryChunk.js其他内容生成一个scirpt标签引入

**详细**
`HTML` 构建插件 即`build-html`插件。之前我们在`内联脚本加载插件`中提到过，项目根目录下的`html`会转换为一段 JavaScript 代码，如下面的这个例子:

1. 对 HTML 执行各个插件中带有 `enforce: "pre"` 属性的 transformIndexHtml 钩子；

2. 将其中的 script 标签内容删除，并将其转换为 `import 语句`如`import './index.ts'`，并记录下来；

3. 在 transform 钩子中返回记录下来的 import 内容，将 import 语句作为模块内容进行加载。也就是说，虽然 Vite 处理的是一个 HTML 文件，但最后进行打包的内容却是一段 JS 的内容，[点击查看具体实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fmain%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fhtml.ts%23L233 "https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/html.ts#L233")。代码简化后如下所示:

```
ts
复制代码
export function buildHtmlPlugin() {
  name: 'vite:build',
  transform(html, id) {
    if (id.endsWith('.html')) {
      let js = '';
      // 省略 HTML AST 遍历过程(通过 @vue/compiler-dom 实现)
      // 收集 script 标签，转换成 import 语句，拼接到 js 字符串中
      return js;
    }
  }
}
```

其次，在生成产物的最后一步即`generateBundle`钩子中，拿到入口 Chunk，分析入口 Chunk 的内容, 分情况进行处理。

如果只有 import 语句，先通过 Rollup 提供的 `chunk` 和 `bundle` 对象获取入口 chunk 所有的依赖 chunk，并将这些 chunk 进行后序排列，如 `a 依赖 b，b 依赖 c`，最后的依赖数组就是`[c, b, a]`。然后依次将 c，b, a 生成三个 script 标签，插入 HTML 中。最后，Vite 会将入口 chunk 的内容从 bundle 产物中移除，因此它的内容只要 import 语句，而它 import 的 chunk 已经作为 script 标签插入到了 HTML 中，那入口 Chunk 的存在也就没有意义了。

如果除了 import 语句，还有其它内容， Vite 就会将入口 Chunk 单独生成一个 `script 标签`，分析出依赖的后序排列(和上一种情况分析手段一样)，然后通过注入 `<link rel="modulepreload"> 标签`对入口文件的依赖 chunk 进行预加载。

最后，插件会调用用户插件中带有 `enforce: "post"` 属性的 transformIndexHtml 钩子，对 HTML 进行进一步的处理

#### 3.4 Commonjs 转换插件

我们知道，在开发环境中，Vite 使用 Esbuild 将 Commonjs 转换为 ESM，而生产环境中，Vite 会直接使用 Rollup 的官方插件 [@rollup/plugin-commonjs](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Frollup%2Fplugins%2Ftree%2Fmaster%2Fpackages%2Fcommonjs "https://github.com/rollup/plugins/tree/master/packages/commonjs")。

#### 3.5 date-uri 插件

date-uri 插件用来支持 import 模块中含有 Base64 编码的情况，如:

#### 3.6 dynamic-import-vars 插件

用于支持在动态 import 中使用变量的功能，如下示例代码:

```ts
function importLocale(locale) {
  return import(`./locales/${locale}.js`);
}

```

#### 3.7 import-meta-url 支持插件

用来转换如下格式的资源 URL:

```
ts
复制代码
new URL('./foo.png', import.meta.url)
```

将其转换为生产环境的 URL 格式，如:

```ts
// 使用 self.location 来保证低版本浏览器和 Web Worker 环境的兼容性
new URL('./assets.a4b3d56d.png', self.location)
```

#### 3.8 生产环境 import 分析插件

`vite:build-import-analysis` 插件会在生产环境打包时用作 import 语句分析和重写，主要目的是对动态 import 的模块进行预加载处理。

对含有动态 import 的 chunk 而言，会在插件的`tranform`钩子中被添加这样一段工具代码用来进行模块预加载，逻辑并不复杂，你可以参考[源码实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2FimportAnalysisBuild.ts%23L43 "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/plugins/importAnalysisBuild.ts#L43")。关键代码简化后如下:

```ts
function preload(importModule, deps) {
  return Promise.all(
    deps.map(dep => {
      // 如果异步模块的依赖还没有加载
      if (!alreadyLoaded(dep)) { 
        // 创建 link 标签加载，包括 JS 或者 CSS
        document.head.appendChild(createLink(dep))  
        // 如果是 CSS，进行特殊处理，后文会介绍
        if (isCss(dep)) {
          return new Promise((resolve, reject) => {
            link.addEventListener('load', resolve)
            link.addEventListener('error', reject)
          })
        }
      }
    })
  ).then(() => importModule())
}
```

我们知道，Vite 内置了 CSS 代码分割的能力，当一个模块通过动态 import 引入的时候，这个模块会被单独打包成一个 chunk，与此同时这个模块中的样式代码也会打包成单独的 CSS 文件。如果异步模块的 CSS 和 JS 同时进行预加载，那么在某些浏览器下(如 IE)就会出现 [FOUC 问题](https://link.juejin.cn/?target=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FFlash_of_unstyled_content%23%3A~%3Atext%3DA%2520flash%2520of%2520unstyled%2520content%2Cbefore%2520all%2520information%2520is%2520retrieved. "https://en.wikipedia.org/wiki/Flash_of_unstyled_content#:~:text=A%20flash%20of%20unstyled%20content,before%20all%20information%20is%20retrieved.")，页面样式会闪烁，影响用户体验。但 Vite 通过监听 link 标签 `load` 事件的方式来保证 CSS 在 JS 之前加载完成，从而解决了 FOUC 问题。

同时，对于 Vite 独有的 import.meta.glob 语法，也会在这个插件中进行编译，如:

```
ts
复制代码
const modules = import.meta.glob('./dir/*.js')
```

会通过插件转换成下面这段代码:

```
ts
复制代码
const modules = {
  './dir/foo.js': () => import('./dir/foo.js'),
  './dir/bar.js': () => import('./dir/bar.js')
}
```

#### 3.9 JS 压缩插件

Vite 中提供了两种 JS 代码压缩的工具，即 Esbuild 和 Terser，分别由两个插件插件实现:

- **vite:esbuild-transpile** ([点击查看实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fesbuild.ts%23L219 "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/plugins/esbuild.ts#L219"))。在 renderChunk 阶段，调用 Esbuild 的 transform API，并指定 minify 参数，从而实现 JS 的压缩。
- **vite:terser**([点击查看实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fterser.ts%23L23 "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/plugins/terser.ts#L23"))。同样也在 renderChunk 阶段，Vite 会单独的 Worker 进程中调用 Terser 进行 JS 代码压缩。

#### 3.10 构建报告插件

- **vite:manifest**([点击查看实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fmanifest.ts "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/plugins/manifest.ts"))。提供打包后的各种资源文件及其关联信息，如下内容所示:

```
json
复制代码
// manifest.json
{
  "index.html": {
    "file": "assets/index.8edffa56.js",
    "src": "index.html",
    "isEntry": true,
    "imports": [
      // JS 引用
      "_vendor.71e8fac3.js"
    ],
    "css": [
      // 样式文件应用
      "assets/index.458f9883.css"
    ],
    "assets": [
      // 静态资源引用
      "assets/img.9f0de7da.png"
    ]
  },
  "_vendor.71e8fac3.js": {
    "file": "assets/vendor.71e8fac3.js"
  }
}
```

- **vite:ssr-manifest**([点击查看实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Fmanifest.ts "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/plugins/manifest.ts"))。提供每个模块与 chunk 之间的映射关系，方便 SSR 时期通过渲染的组件来确定哪些 chunk 会被使用，从而按需进行预加载。最后插件输出的内容如下:

```
ts
复制代码
// ssr-manifest.json
{
  "node_modules/object-assign/index.js": [
    "/assets/vendor.71e8fac3.js"
  ],
  "node_modules/object-assign/index.js?commonjs-proxy": [
    "/assets/vendor.71e8fac3.js"
  ],
  // 省略其它模块信息
}
```

- **vite:reporter**([点击查看实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fplugins%2Freporter.ts "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/plugins/reporter.ts"))。主要提供打包时的命令行构建日志:

![image.png]()

### 4. 开发环境特有插件

#### 4.1 客户端环境变量注入插件

在开发环境中，Vite 会自动往 HTML 中注入一段 client 的脚本([点击查看实现](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fblob%2Fv2.7.0%2Fpackages%2Fvite%2Fsrc%2Fnode%2Fserver%2Fmiddlewares%2FindexHtml.ts%23L159 "https://github.com/vitejs/vite/blob/v2.7.0/packages/vite/src/node/server/middlewares/indexHtml.ts#L159")):

```
ts
复制代码
<script type="module" src="/@vite/client"></script>
```

这段脚本主要提供`注入环境变量`、`处理 HMR 更新逻辑`、`构建出现错误时提供报错界面`等功能，而我们这里要介绍的`vite:client-inject`就是来完成时环境变量的注入，将 client 脚本中的`__MODE__`、`__BASE__`、`__DEFINE__`等等字符串替换为运行时的变量，实现环境变量以及 HMR 相关上下文信息的注入

#### 4.2 开发阶段 import 分析插件

最后，Vite 会在开发阶段加入 import 分析插件，即`vite:import-analysis`。与之前所介绍的`vite:build-import-analysis`相对应

- 对 bare import，将路径名转换为真实的文件路径
- 对于 HMR 的客户端 API，即 `import.meta.hot`，Vite 在识别到这样的 import 语句后，一方面会注入 import.meta.hot 的实现

- 注入全局环境变量读取语句，即 `import.meta.env`

- 对于`import.meta.glob`语法，Vite 同样会调用之前提到的`transformImportGlob` 函数来进行语法转换
