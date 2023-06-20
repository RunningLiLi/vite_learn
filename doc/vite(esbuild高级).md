# vite(esbuild高级)
## 预构建核心流程
### 判断缓存
首先是预构建缓存的判断。Vite 在每次预构建之后都将一些关键信息写入到了`_metadata.json`文件中，第二次启动项目时会通过这个文件中的 hash 值来进行缓存的判断，如果命中缓存则不会进行后续的预构建流程

哈希计算的策略
```
const lockfileFormats = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
function getDepHash(root: string, config: ResolvedConfig): string {
  // 获取 lock 文件内容
  let content = lookupFile(root, lockfileFormats) || "";
  // 除了 lock 文件外，还需要考虑下面的一些配置信息
  content += JSON.stringify(
    {
      // 开发/生产环境
      mode: config.mode,
      // 项目根路径
      root: config.root,
      // 路径解析配置
      resolve: config.resolve,
      // 自定义资源类型
      assetsInclude: config.assetsInclude,
      // 插件
      plugins: config.plugins.map((p) => p.name),
      // 预构建配置
      optimizeDeps: {
        include: config.optimizeDeps?.include,
        exclude: config.optimizeDeps?.exclude,
      },
    },
    // 特殊处理函数和正则类型
    (_, value) => {
      if (typeof value === "function" || value instanceof RegExp) {
        return value.toString();
      }
      return value;
    }
  );
  // 最后调用 crypto 库中的 createHash 方法生成哈希
  return createHash("sha256").update(content).digest("hex").substring(0, 8);
}
```
### 依赖扫描
如果没有命中缓存，则会正式地进入依赖预构建阶段。不过 Vite 不会直接进行依赖的预构建，而是在之前探测一下项目中存在哪些依赖，收集依赖列表，也就是进行`依赖扫描`的过程。这个过程是必须的，因为 Esbuild 需要知道我们到底要打包哪些第三方依赖。关键代码如下:
```
const deps: Record<string, string> = {};
// 扫描用到的 Esbuild 插件
const plugin = esbuildScanPlugin(config, container, deps, missing, entries);
await Promise.all(
  // 应用项目入口
  entries.map((entry) =>
    build({
      absWorkingDir: process.cwd(),
      // 注意这个参数
      write: false,
      entryPoints: [entry],
      bundle: true,
      format: "esm",
      logLevel: "error",
      plugins: [...plugins, plugin],
      ...esbuildOptions,
    })
  )
);
```
### 依赖打包
```
const result = await build({
  absWorkingDir: process.cwd(),
  // 所有依赖的 id 数组，在插件中会转换为真实的路径
  entryPoints: Object.keys(flatIdDeps),
  bundle: true,
  format: "esm",
  target: config.build.target || undefined,
  external: config.optimizeDeps?.exclude,
  logLevel: "error",
  splitting: true,
  sourcemap: true,
  outdir: cacheDir,
  ignoreAnnotations: true,
  metafile: true,
  define,
  plugins: [
    ...plugins,
    // 预构建专用的插件
    esbuildDepPlugin(flatIdDeps, flatIdToExports, config, ssr),
  ],
  ...esbuildOptions,
});
// 打包元信息，后续会根据这份信息生成 _metadata.json
const meta = result.metafile!;
```
### 元信息写入磁盘
将上面得到的meta信息写入_metadata文件中。

## 依赖扫描详细分析


### 1.获取入口
- 入口文件可能存在于多个配置当中，比如`optimizeDeps.entries`和`build.rollupOptions.input`，同时需要考虑数组和对象的情况；也可能用户没有配置，需要自动探测入口文件。
- 入口文件的类型，一般情况下入口需要是`js/ts`文件，但实际上像 html、vue 单文件组件这种类型我们也是需要支持的，因为在这些文件中仍然可以包含 script 标签的内容，从而让我们搜集到依赖信息
### 2. 如何记录依赖
```ts
build.onResolve(
  {
    // avoid matching windows volume
    filter: /^[\w@][^:]/,
  },
  async ({ path: id, importer }) => {
    // 如果在 optimizeDeps.exclude 列表或者已经记录过了，则将其 externalize (排除)，直接 return

    // 接下来解析路径，内部调用各个插件的 resolveId 方法进行解析
    const resolved = await resolve(id, importer);
    if (resolved) {
      // 判断是否应该 externalize，下个部分详细拆解
      if (shouldExternalizeDep(resolved, id)) {
        return externalUnlessEntry({ path: id });
      }

      if (resolved.includes("node_modules") || include?.includes(id)) {
        // 如果 resolved 为 js 或 ts 文件
        if (OPTIMIZABLE_ENTRY_RE.test(resolved)) {
          // 注意了! 现在将其正式地记录在依赖表中
          depImports[id] = resolved;
        }
        // 进行 externalize，因为这里只用扫描出依赖即可，不需要进行打包，具体实现后面的部分会讲到
        return externalUnlessEntry({ path: id });
      } else {
        // resolved 为 「类 html」 文件，则标记上 'html' 的 namespace
        const namespace = htmlTypesRE.test(resolved) ? "html" : undefined;
        // linked package, keep crawling
        return {
          path: path.resolve(resolved),
          namespace,
        };
      }
    } else {
      // 没有解析到路径，记录到 missing 表中，后续会检测这张表，显示相关路径未找到的报错
      missing[id] = normalizePath(importer);
    }
  }
);

```
收集所有需要预构建的依赖
```ts
const resolve = async (id: string, importer?: string) => {
  // 通过 seen 对象进行路径缓存
  const key = id + (importer && path.dirname(importer));
  if (seen.has(key)) {
    return seen.get(key);
  }
  // 调用插件容器的 resolveId
  // 关于插件容器下一节会详细介绍，这里你直接理解为调用各个插件的 resolveId 方法解析路径即可
  const resolved = await container.resolveId(
    id,
    importer && normalizePath(importer)
  );
  const res = resolved?.id;
  seen.set(key, res);
  return res;
};
```
### 3. external 的规则如何制定？
使esbuild排除某些路径
``` ts
// data url，直接标记 external: true，不让 esbuild 继续处理
build.onResolve({ filter: dataUrlRE }, ({ path }) => ({
  path,
  external: true,
}));
// 加了 ?worker 或者 ?raw 这种 query 的资源路径，直接 external
build.onResolve({ filter: SPECIAL_QUERY_RE }, ({ path }) => ({
  path,
  external: true,
}));
// css & json
build.onResolve(
  {
    filter: /.(css|less|sass|scss|styl|stylus|pcss|postcss|json)$/,
  },
  // 非 entry 则直接标记 external
  externalUnlessEntry
);
// Vite 内置的一些资源类型，比如 .png、.wasm 等等
build.onResolve(
  {
    filter: new RegExp(`\.(${KNOWN_ASSET_TYPES.join("|")})$`),
  },
  // 非 entry 则直接标记 external
  externalUnlessEntry
);
```
//排除被resolve函数处理过的路径
```ts
export function shouldExternalizeDep(
  resolvedId: string,
  rawId: string
): boolean {
  // 解析之后不是一个绝对路径，不在 esbuild 中进行加载
  if (!path.isAbsolute(resolvedId)) {
    return true;
  }
  // 1. import 路径本身就是一个绝对路径
  // 2. 虚拟模块(Rollup 插件中约定虚拟模块以`\0`开头)
  // 都不在 esbuild 中进行加载
  if (resolvedId === rawId || resolvedId.includes("\0")) {
    return true;
  }
  // 不是 JS 或者 类 HTML 文件，不在 esbuild 中进行加载
  if (!JS_TYPES_RE.test(resolvedId) && !htmlTypesRE.test(resolvedId)) {
    return true;
  }
  return false;
}
```
## 依赖打包详细分析

### 1.扁平化的产物文件结构
1.  嵌套路径扁平化，`/`被换成下划线，如 `react/jsx-dev-runtime`，被重写为`react_jsx-dev-runtime`；

<!---->

2.  用虚拟模块来代替真实模块，作为预打包的入口。

```ts
const flatIdDeps: Record<string, string> = {};
const idToExports: Record<string, ExportsData> = {};
const flatIdToExports: Record<string, ExportsData> = {};
// deps 即为扫描后的依赖表
// 形如: {
//    react :  /Users/sanyuan/vite-project/react/index.js  }
//    react/jsx-dev-runtime :  /Users/sanyuan/vite-project/react/jsx-dev-runtime.js
// }
for (const id in deps) {
  // 扁平化路径，`react/jsx-dev-runtime`，被重写为`react_jsx-dev-runtime`；
  const flatId = flattenId(id);
  // 填入 flatIdDeps 表，记录 flatId -> 真实路径的映射关系
  const filePath = (flatIdDeps[flatId] = deps[id]);
  const entryContent = fs.readFileSync(filePath, "utf-8");
  // 后续代码省略
}
```
> 注：**虚拟模块加载部分的代码**在 Vite 3.0 中已被移除，原因是 Esbuild 输出扁平化产物路径已不再需要使用虚拟模块，PR 地址: [github.com/vitejs/vite…](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvitejs%2Fvite%2Fpull%2F10427 "https://github.com/vitejs/vite/pull/10427") 如下部分的小册内容你可以进行选读。
### 2. 代理模块加载
整体的思路就是先分析一遍模块真实入口文件的`import`和`export`语法，然后在代理模块中进行重导出

```js
let contents = "";
contents += `export default require( ${relativePath} );`;

```
 ``` ts
 // 默认导出，即存在 export default 语法
if (exports.includes("default")) {
  contents += `import d from  ${relativePath} ;export default d;`;
}
// 非默认导出
if (
  // 1. 存在 `export * from` 语法，前文分析过
  data.hasReExports ||
  // 2. 多个导出内容
  exports.length > 1 ||
  // 3. 只有一个导出内容，但这个导出不是 export default
  exports[0] !== "default"
) {
  // 凡是命中上述三种情况中的一种，则添加下面的重导出语句
  contents += `\nexport * from  ${relativePath} `;
}
```

```js
let ext = path.extname(entryFile).slice(1);
if (ext === "mjs") ext = "js";
return {
  loader: ext as Loader,
  // 虚拟模块内容
  contents,
  resolveDir: root,
};

```
Vite 会使用 `dep:react`这个代理模块来作为入口内容在 Esbuild 中进行加载，与此同时，其他库的预打包也有可能会引入 React，比如`@emotion/react`这个库里面会有`require('react')`的行为。那么在 Esbuild 打包之后，`react.js`与`@emotion_react.js`的代码中会引用同一份 Chunk 的内容，这份 Chunk 也就对应 React 入口文件(`node_modules/react/index.js`)。
现在如果代理模块通过文件系统直接读取真实模块的内容，而不是进行重导出，因此由于此时代理模块跟真实模块并没有任何的引用关系，这就导致最后的`react.js`和`@emotion/react.js`两份产物并不会引用同一份 Chunk，Esbuild 最后打包出了内容完全相同的两个 Chunk！
















