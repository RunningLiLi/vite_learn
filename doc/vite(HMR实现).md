# vite(HMR的实现)

## 创建模块依赖图

- 初始化依赖图实例
- 创建依赖图节点
- 绑定各个模块节点的依赖关系

1. 服务器开启时初始化ModuleGraph

```js
// 由原始请求 url 到模块节点的映射，如 /src/index.tsx
urlToModuleMap = new Map<string, ModuleNode>()
// 由模块 id 到模块节点的映射，其中 id 与原始请求 url，为经过 resolveId 钩子解析后的结果
idToModuleMap = new Map<string, ModuleNode>()
// 由文件到模块节点的映射，由于单文件可能包含多个模块，如 .vue 文件，因此 Map 的 value 值为一个集合
fileToModulesMap = new Map<string, Set<ModuleNode>>()
```

2. Vite Dev Server 中的`transform`中间件，创建ModuleNode 节点。

ModuleNode具有包含`importers` 和`importedModules`，这两条信息分别代表了当前模块被哪些模块引用以及它依赖了哪些模块

3. `vite:import-analysis`插件的transform钩子中会绑定各个模块节点的依赖关系

## 服务端收集更新模块

- 对于配置文件和环境变量声明文件的改动，Vite 会直接重启服务器。
- 对于客户端注入的文件(vite/dist/client/client.mjs)的改动，Vite 会给客户端发送`full-reload`信号，让客户端刷新页面。
- 对于普通文件改动，Vite 首先会获取需要热更新的模块，然后对这些模块依次查找热更新边界，然后将模块更新的信息传给客户端

## 客户端派发更新
>
>Vite 在开发阶段会默认在 HTML 中注入一段客户端的脚本,和服务器websocket建立双向连接，并监听message事件

客户端会通过websocket接受服务器发送的更新

```js
{
  type: "update",
  update: [
    {
      // 更新类型，也可能是 `css-update`
      type: "js-update",
      // 更新时间戳
      timestamp: 1650702020986,
      // 热更模块路径
      path: "/src/main.ts",
      // 接受的子模块路径
      acceptedPath: "/src/render.ts"
    }
  ]
}
// 或者 full-reload 信号
{
  type: "full-reload"
}

```

找到所有需要更新的模块，动态import最新模块内容，然后返回更新回调，即 import.meta.hot.accept 中定义的回调函数，让`queueUpdate`这个调度函数执行更新回调，从而完成**派发更新**的过程

```js
  // 3. 对将要更新的模块进行失活操作，并通过动态 import 拉取最新的模块信息
  await Promise.all(
    Array.from(modulesToUpdate).map(async (dep) => {
      const disposer = disposeMap.get(dep)
      if (disposer) await disposer(dataMap.get(dep))
      const [path, query] = dep.split(`?`)
      try {
        const newMod = await import(
          /* @vite-ignore */
          base +
            path.slice(1) +
            `?import&t=${timestamp}${query ? `&${query}` : ''}`
        )
        moduleMap.set(dep, newMod)
      } catch (e) {
        warnFailedFetch(e, dep)
      }
    })
  )
```

## 总结

首先，Vite 为了更方便地管理模块之间的关系，创建了模块依赖图的数据结构，在 HMR 过程中，服务端会根据这张图来寻找 HMR 边界模块。

其次，HMR 更新由客户端和服务端配合完成，两者通过 WebSocket 进行数据传输。在服务端，Vite 通过查找模块依赖图确定热更新的边界，并将局部更新的信息传递给客户端，而客户端接收到热更信息后，会通过动态 import 请求并加载最新模块的内容，并执行派发更新的回调，即 import.meta.hot.accept 中定义的回调函数，从而完成完整的热更新过程
