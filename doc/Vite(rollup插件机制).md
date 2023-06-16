# Vite(rollup 插件机制)

比如**路径别名(alias)** 、**全局变量注入**和**代码压缩**等等。

## Rollup 整体构建阶段

```
// Build 阶段
const bundle = await rollup.rollup(inputOptions);

// Output 阶段
await Promise.all(outputOptions.map(bundle.write));

// 构建结束
await bundle.close();
```

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/aa65546d0f0e45ceadb0974ea0fade7a~tplv-k3u1fbpfcp-watermark.image?)
`write`和`generate`方法唯一的区别在于前者打包完产物会写入磁盘，而后者不会）。
主要就是 build 和 output 阶段
**对于一次完整的构建过程而言，** **Rollup** **会先进入到 Build 阶段，解析各模块的内容及依赖关系，然后进入**`Output`**阶段，完成打包及输出的过程**

## 拆解插件工作流

### Build&Output 阶段

根据这两个构建阶段分为两类: `Build Hook` 与 `Output Hook`。

- `Build Hook`即在`Build`阶段执行的钩子函数，在这个阶段主要进行模块代码的转换、AST 解析以及模块依赖的解析，那么这个阶段的 Hook 对于代码的操作粒度一般为`模块`级别，也就是单文件级别。
- `Ouput Hook`(官方称为`Output Generation Hook`)，则主要进行代码的打包，对于代码而言，操作粒度一般为 `chunk`级别(一个 chunk 通常指很多文件打包到一起的产物)。
  根据不同的 Hook 执行方式也会有不同的分类，主要包括`Async`、`Sync`、`Parallel`、`Squential`、`First`这五种

### 1. Async & Sync

    异步和同步执行

### 2. Parallel

    并行

### 3. Sequential

    串行

### 4. First

    如果有多个插件实现了这个 Hook，那么 Hook 将依次运行，直到返回一个非 null 或非 undefined 的值为止。比较典型的 Hook 是 `resolveId`，一旦有插件的 resolveId 返回了一个路径，将停止执行后续插件的 resolveId 逻辑。

## Build 阶段工作流

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e305d70370244afc807d70b46a73f9ec~tplv-k3u1fbpfcp-watermark.image?)

1. 首先经历 `options` 钩子进行配置的转换，得到处理后的配置对象。

2. 随之 Rollup 会调用`buildStart`钩子，正式开始构建流程。

3. Rollup 先进入到 `resolveId` 钩子中解析文件路径。(从 `input` 配置指定的入口文件开始)。

4. Rollup 通过调用`load`钩子加载模块内容。

5. 紧接着 Rollup 执行所有的 `transform` 钩子来对模块内容进行进行自定义的转换，比如 babel 转译。

6. 现在 Rollup 拿到最后的模块内容，进行 AST 分析，得到所有的 import 内容，调用 moduleParsed 钩子:

   - **6.1** 如果是普通的 import，则执行 `resolveId` 钩子，继续回到步骤`3`。
   - **6.2** 如果是动态 import，则执行 `resolveDynamicImport` 钩子解析路径，如果解析成功，则回到步骤`4`加载模块，否则回到步骤`3`通过 `resolveId` 解析路径。

7. 直到所有的 import 都解析完毕，Rollup 执行`buildEnd`钩子，Build 阶段结束。

当然，在 Rollup 解析路径的时候，即执行`resolveId`或者`resolveDynamicImport`的时候，有些路径可能会被标记为`external`(翻译为`排除`)，也就是说不参加 Rollup 打包过程，这个时候就不会进行`load`、`transform`等等后续的处理了。
<br/>
在流程图最上面，不知道大家有没有注意到`watchChange`和`closeWatcher`这两个 Hook，这里其实是对应了 rollup 的`watch`模式。当你使用 `rollup --watch` 指令或者在配置文件配有`watch: true`的属性时，代表开启了 Rollup 的`watch`打包模式，这个时候 Rollup 内部会初始化一个 `watcher` 对象，当文件内容发生变化**路径解析: resolveId**时，watcher 对象会自动触发`watchChange`钩子执行并对项目进行重新构建。在当前**打包过程结束**时，Rollup 会自动清除 watcher 对象调用`closeWacher`钩子。

## Output 阶段工作流

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/28310865c124451da4c37aaf09f0cb12~tplv-k3u1fbpfcp-watermark.image?)

![IMG_20230607_135707.jpg](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f18b752e598b4aa6a34f9dbc2c8955ca~tplv-k3u1fbpfcp-watermark.image?)

## 常用 Hook 实战

https://github.com/RunningLiLi/vite_learn/tree/master/packages/rollup
