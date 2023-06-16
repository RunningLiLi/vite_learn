# vite(plugins)

## 开始

Vite 插件与 Rollup 插件结构类似，为一个`name`和各种插件 Hook 的对象:

```
{
  // 插件名称
  name: 'vite-plugin-xxx',
  load(code) {
    // 钩子逻辑
  },
}
```

一般为函数

```
// myPlugin.js
export function myVitePlugin(options) {
  console.log(options)
  return {
    name: 'vite-plugin-xxx',
    load(id) {
      // 在钩子逻辑中可以通过闭包访问外部的 options 传参
    }
  }
}
```

## vite 和 rollup 通用 hook

- **服务器启动阶段**: `options`和`buildStart`钩子会在服务启动时被调用。
- **请求响应阶段**: 当浏览器发起请求时，Vite 内部依次调用`resolveId`、`load`和`transform`钩子。
- **服务器关闭阶段**: Vite 会依次执行`buildEnd`和`closeBundle`钩子。
  > 上面说的是开发阶段，生成阶段直接用的是 rollup，所以 rollup 的 hook 都会生效

## vite 特有 hook

### config

返回的配置会和传入配置合并

```
const mutateConfigPlugin = () => ({
  name: 'mutate-config',
  // command 为 `serve`(开发环境) 或者 `build`(生产环境)
  config(config, { command }) {
    // 生产环境中修改 root 参数
    if (command === 'build') {
      config.root = __dirname;
     return {
        optimizeDeps: {
        esbuildOptions: {
             plugins: []
          }
        }
      }
    }
  }
})
```

### configResolved

```ts
const exmaplePlugin = () => {
  let config;

  return {
    name: "read-config",

    configResolved(resolvedConfig) {
      // 记录最终配置
      config = resolvedConfig;
    },

    // 在其他钩子中可以访问到配置
    transform(code, id) {
      console.log(config);
    },
  };
};
```

### 配置开发服务器:configureServer

```
const myPlugin = () => ({
  name: 'configure-server',
  configureServer(server) {
    // 姿势 1: 在 Vite 内置中间件之前执行
    server.middlewares.use((req, res, next) => {
      // 自定义请求处理逻辑
    })
    // 姿势 2: 在 Vite 内置中间件之后执行
    return () => {
      server.middlewares.use((req, res, next) => {
        // 自定义请求处理逻辑
      })
    }
  }
})
```

### 转换 HTML 内容: transformIndexHtml

```ts
const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return html.replace(
        /<title>(.*?)</title>/,
        `<title>换了个标题</title>`
      )
    }
  }
}
// 也可以返回如下的对象结构，一般用于添加某些标签
const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return {
        html,
        // 注入标签
        tags: [
          {
            // 放到 body 末尾，可取值还有`head`|`head-prepend`|`body-prepend`，顾名思义
            injectTo: 'body',
            // 标签属性定义
            attrs: { type: 'module', src: './index.ts' },
            // 标签名
            tag: 'script',
          },
        ],
      }
    }
  }
}
```

### 热更新处理: handleHotUpdate

```
const handleHmrPlugin = () => {
  return {
    async handleHotUpdate(ctx) {
      // 需要热更的文件
      console.log(ctx.file)
      // 需要热更的模块，如一个 Vue 单文件会涉及多个模块
      console.log(ctx.modules)
      // 时间戳
      console.log(ctx.timestamp)
      // Vite Dev Server 实例
      console.log(ctx.server)
      // 读取最新的文件内容
      console.log(await read())
      // 自行处理 HMR 事件
      ctx.server.ws.send({
        type: 'custom',
        event: 'special-update',
        data: { a: 1 }
      })
      return []
    }
  }
}

// 前端代码中加入
if (import.meta.hot) {
  import.meta.hot.on('special-update', (data) => {
    // 执行自定义更新
    // { a: 1 }
    console.log(data)
    window.location.reload();
  })
}
```

## 插件 Hook 执行顺序

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e569956cfb194d2288ed835747e8bd99~tplv-k3u1fbpfcp-watermark.image?)

## 插件应用位置

- 一般同时作用于开发和生产
- apply

```
{
  // 'serve' 表示仅用于开发环境，'build'表示仅用于生产环境
  apply: 'serve'
}
```

```
apply(config, { command }) {
  // 只用于非 SSR 情况下的生产环境构建
  return command === 'build' && !config.build.ssr
}
```

- `enforce`

```
{
  // 默认为`normal`，可取值还有`pre`和`post`
  enforce: 'pre'
}
```

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1696fd05f070421daba45b40dbbef77b~tplv-k3u1fbpfcp-watermark.image?)

## 虚拟模块加载插件

## svg 组件加载模块

https://github.com/RunningLiLi/vite_learn/tree/master/packages/vite_plugins/plugins

## 附加

```
const esbuildPackagePath = resolve.sync("esbuild", {
basedir: require.resolve("vite"),
});
```

- resolve 是 npm 的一个库，require.resolve 是 node 自带的方法
- require.resolve 获取 vite 的决定路径
- resolve 获取基于 vite 的决对路径的 esbuild 的绝对路径
- fs.promises.readFile 是是 node 自带的 promise 类型的 readFile
-
