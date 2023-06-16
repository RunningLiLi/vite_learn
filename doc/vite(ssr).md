# vite(ssr)

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5d4a94d1475b4d4aac0f1bd765a74d30~tplv-k3u1fbpfcp-watermark.image?)

## CSR 问题

### 1.首屏加载慢

### 2.SEO 不友好

## SSR 生命周期

### 构建时

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2e9cc2a5b03b491ba3e4e165df9ef65a~tplv-k3u1fbpfcp-watermark.image?)

#### 1.模块加载问题

在原有的构建过程之外，需要加入`SSR 构建`的过程 ，具体来说，我们需要另外生成一份 `CommonJS` 格式的产物，使之能在 Node.js 正常加载。当然，随着 Node.js 本身对 ESM 的支持越来越成熟，我们也可以复用前端 ESM 格式的代码，Vite 在开发阶段进行 SSR 构建也是这样的思路。

#### 2.样式代码移除

直接引入一行 css 在服务端其实是无法执行的，因为 Node.js 并不能解析 CSS 的内容。但 `CSS Modules` 的情况除外，如下所示:

```
import styles from './index.module.css'

// 这里的 styles 是一个对象，如{ "container": "xxx" }，而不是 CSS 代码
console.log(styles)
```

#### 3.依赖外部化

对于某些第三方依赖我们并不需要使用构建后的版本，而是直接从 `node_modules` 中读取，比如 `react-dom`，这样在 `SSR 构建`的过程中将不会构建这些依赖，从而极大程度上加速 SSR 的构建。

> 注意是 node 环境，可以直接用 node_modules 的包

### 运行时

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e97f0c98359148f3a649998ff695e93e~tplv-k3u1fbpfcp-watermark.image?)

#### 1.加载 SSR 入口模块

在这个阶段，我们需要确定 SSR 构建产物的入口，即组件的入口在哪里，并加载对应的模块。

#### 2.进行数据预取

这时候 Node 侧会通过查询数据库或者网络请求来获取应用所需的数据。

#### 3.渲染组件

这个阶段为 SSR 的核心，主要将第 `1` 步中加载的组件渲染成 HTML 字符串或者 Stream 流。

#### 4.HTML 拼接

在组件渲染完成之后，我们需要拼接完整的 HTML 字符串，并将其作为响应返回给浏览器

## 基于 vite 搭建 ssr 项目

### SSR 构建 API

#### ssrLoadModule

开发 api，no-bundle

```
// 加载服务端入口模块
const xxx = await vite.ssrLoadModule('/src/entry-server.tsx')
```

#### vite build --ssr "entry"

```
{
  "build:ssr": "vite build --ssr 服务端入口路径"
}
```

### 项目骨架

```
npm init vite
pnpm i
```

删除项目自带的`src/main.ts`，然后在 src 目录下新建`entry-client.tsx`和`entry-server.tsx`两个入口文件:

```
// entry-client.ts
// 客户端入口文件
import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'

ReactDOM.hydrate(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)

// entry-server.ts
// 导出 SSR 组件入口
import App from "./App";
import './index.css'

function ServerEntry(props: any) {
  return (
    <App/>
  );
}

export { ServerEntry };
```

```
pnpm i express -S
pnpm i @types/express -D
```

```
// src/ssr-server/index.ts
// 后端服务
import express from 'express';

async function createServer() {
  const app = express();

  app.listen(3000, () => {
    console.log('Node 服务器已启动~')
    console.log('http://localhost:3000');
  });
}

createServer();
```

```
{
  "scripts": {
    // 开发阶段启动 SSR 的后端服务
    "dev": "nodemon --watch src/ssr-server --exec 'esno src/ssr-server/index.ts'",
    // 打包客户端产物和 SSR 产物
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --ssr src/entry-server.tsx --outDir dist/server",
    // 生产环境预览 SSR 效果
    "preview": "NODE_ENV=production esno src/ssr-server/index.ts"
  },
}
```

### SSR 运行时实现

ssr 中间件

```
export async function createSsrMiddleware(
  app: Express
): Promise<RequestHandler> {
  let vite: ViteDevServer | null = null;
  if (!isProd) {
    vite = await (
      await import("vite")
    ).createServer({
      root: cwd,
     appType: "custom",
      server: {
        middlewareMode: true,
      },
    });
    // 注册 Vite Middlewares
    // 主要用来处理客户端资源
    app.use(vite.middlewares);

  }
  return async (req, res, next) => {
    // SSR 的逻辑
    // 1. 加载服务端入口模块
    const { ServerEntry } = await loadSsrEntryModule(vite);
    // 2. 数据预取
    const data = await preFetch();
    // 3. 「核心」渲染组件
    const appHtml = ReactDOM.renderToString(
      React.createElement(ServerEntry, data)
    );
    const html = await spliceHtml(appHtml, req.originalUrl, vite, data);
    // 4. 拼接 HTML，返回响应
    res.status(200).setHeader("Content-Type", "text/html").end(html);
    next();
  };
}
```

https://github.com/RunningLiLi/vite_learn/blob/master/packages/ssr/src/ssr-server/middleware.ts

### 生产环境的 CSR 资源处理

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3889efdb12094a5b9f151f3ff8172e8e~tplv-k3u1fbpfcp-watermark.image?)

```
pnpm i serve-static -S
```

```
// 过滤出页面请求
function matchPageUrl(url: string) {
  if (url === '/') {
    return true;
  }
  return false;
}

async function createSsrMiddleware(app: Express): Promise<RequestHandler> {
  return async (req, res, next) => {
    try {
      const url = req.originalUrl;
      if (!matchPageUrl(url)) {
        // 走静态资源的处理
        return await next();
      }
      // SSR 的逻辑省略
    } catch(e: any) {
      vite?.ssrFixStacktrace(e);
      console.error(e);
      res.status(500).end(e.message);
    }
  }
}

async function createServer() {
  const app = express();
  // 加入 Vite SSR 中间件
  app.use(await createSsrMiddleware(app));

  // 注册中间件，生产环境端处理客户端资源
  if (isProd) {
    app.use(serve(path.join(cwd, 'dist/client')))
  }
  // 省略其它代码
}
```

## 工程化问题

### 路由管理

1.  （ssr 渲染哪一个路由）告诉框架现在渲染哪个路由。在 Vue 中我们可以通过 `router.push` 确定即将渲染的路由，React 中则通过 `StaticRouter` 配合`location`参数来完成。
2.  （部署服务器子目录） 设置 `base` 前缀。规定路径的前缀，如`vue-router` 中 [base 参数](https://link.juejin.cn?target=https%3A%2F%2Frouter.vuejs.org%2Fzh%2Fguide%2Fmigration%2F%23%25E7%25A7%25BB%25E5%258A%25A8%25E4%25BA%2586-base-%25E9%2585%258D%25E7%25BD%25AE "https://router.vuejs.org/zh/guide/migration/#%E7%A7%BB%E5%8A%A8%E4%BA%86-base-%E9%85%8D%E7%BD%AE")、`react-router`中`StaticRouter`组件的 [basename](https://link.juejin.cn?target=https%3A%2F%2Fv5.reactrouter.com%2Fweb%2Fapi%2FStaticRouter "https://v5.reactrouter.com/web/api/StaticRouter")。

### 全局状态管理

对于全局的状态管理而言，对于不同的框架也有不同的生态和方案，比如 Vue 中的 [Vuex](https://link.juejin.cn?target=https%3A%2F%2Fvuex.vuejs.org%2F "https://vuex.vuejs.org/")、[Pinia](https://link.juejin.cn?target=https%3A%2F%2Fpinia.vuejs.org%2F "https://pinia.vuejs.org/")，React 中的 [Redux](https://link.juejin.cn?target=https%3A%2F%2Fredux.js.org%2Fintroduction%2Fgetting-started "https://redux.js.org/introduction/getting-started")、[Recoil](https://link.juejin.cn?target=https%3A%2F%2Frecoiljs.org%2Fzh-hans%2F "https://recoiljs.org/zh-hans/")。各个状态管理工具的用法并不是本文的重点，接入 SSR 的思路也比较简单，在`预取数据`阶段初始化服务端的 `store` ，将异步获取的数据存入 `store` 中，然后在 `拼接 HTML`阶段将数据从 store 中取出放到数据 script 标签中，最后在客户端 hydrate 的时候通过 window 即可访问到预取数据。

> 需要注意的服务端处理许多不同的请求，对于每个请求都需要**分别**初始化 store，即一个请求一个 store，不然会造成全局状态污染的问题。

### CSR 降级

- 1.  服务器端**预取数据**失败，需要降级到客户端获取数据。
- 2.  服务器出现异常，需要返回**兜底的 CSR 模板**，完全降级为 CSR。
- 3.  本地**开发调试**，有时需要跳过 SSR，仅进行 CSR。

1.客户端检查 window 上的 store，没有则重新请求

```
// entry-client.tsx
import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'

async function fetchData() {
  // 客户端获取数据
}


async fucntion hydrate() {
  let data;
  if (window.__SSR_DATA__) {
    data = window.__SSR_DATA__;
  } else {
    // 降级逻辑
    data = await fetchData();
  }
  // 也可简化为 const data = window.__SSR_DATA__ ?? await fetchData();
  ReactDOM.hydrate(
    <React.StrictMode>
      <App data={data}/>
    </React.StrictMode>,
    document.getElementById('root')
  )
}
```

2.服务器出错则直接返回 CSR 模板（就那个 root div 那个）

```
async function createSsrMiddleware(app: Express): Promise<RequestHandler> {
  return async (req, res, next) => {
    try {
      // SSR 的逻辑省略
    } catch(e: any) {
      vite?.ssrFixStacktrace(e);
      console.error(e);
      // 在这里返回浏览器 CSR 模板内容
    }
  }
}
```

3.我们可以通过 `?csr` 的 url query 参数来强制跳过 SSR，在 SSR 中间件添加如下逻辑:

```
async function createSsrMiddleware(app: Express): Promise<RequestHandler> {
  return async (req, res, next) => {
    try {
      if (req.query?.csr) {
        // 响应 CSR 模板内容
        return;
      }
      // SSR 的逻辑省略
    } catch(e: any) {
      vite?.ssrFixStacktrace(e);
      console.error(e);
    }
  }
}
```

### 浏览器 API 兼容

由于 Node.js 中不能使用浏览器里面诸如 `window`、`document`之类的 API，因此一旦在服务端执行到这样的 API 会报如下的错误：

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/baf43d8460f44e04b47866250805cd79~tplv-k3u1fbpfcp-watermark.image?)
1.import.meta.env.SSR

```
if (import.meta.env.SSR) {
  // 服务端执行的逻辑
} else {
  // 在此可以访问浏览器的 API
}
```

2.polyfill(jsdom)

```
const jsdom = require('jsdom');
const { window } = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
const { document } = window;
// 挂载到 node 全局
global.window = window;
global.document = document;
```

### 自定义 Head

```
// 前端组件逻辑
import { Helmet } from "react-helmet";

function App(props) {
  const { data } = props;
  return {
    <div>
       <Helmet>
        <title>{ data.user }的页面</title>
        <link rel="canonical" href="http://mysite.com/example" />
      </Helmet>
    </div>
  }
}
// 服务端逻辑
import Helmet from 'react-helmet';

// renderToString 执行之后
const helmet = Helmet.renderStatic();
console.log("title 内容: ", helmet.title.toString());
console.log("link 内容: ", helmet.link.toString())
```

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b83a42c95d1c4e618a5eeab358528b5d~tplv-k3u1fbpfcp-watermark.image?)
如此一来，我们就能根据组件的状态确定 Head 内容，然后在`拼接 HTML`阶段将这些内容插入到模板中

### 流式渲染

在不同前端框架的底层都实现了流式渲染的能力，即边渲染边响应，而不是等整个组件树渲染完毕之后再响应，这么做可以让响应提前到达浏览器，提升首屏的加载性能。Vue 中的 [renderToNodeStream](https://link.juejin.cn?target=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40vue%2Fserver-renderer "https://www.npmjs.com/package/@vue/server-renderer") 和 React 中的 [renderToNodeStream](https://link.juejin.cn?target=https%3A%2F%2Freactjs.org%2Fdocs%2Freact-dom-server.html%23rendertonodestream "https://reactjs.org/docs/react-dom-server.html#rendertonodestream") 都实现了流式渲染的能力, 大致的使用方式如下:

```
import { renderToNodeStream } from 'react-dom/server';

// 返回一个 Nodejs 的 Stream 对象
const stream = renderToNodeStream(element);
let html = ''

stream.on('data', data => {
  html += data.toString()
  // 发送响应
})

stream.on('end', () => {
  console.log(html) // 渲染完成
  // 发送响应
})

stream.on('error', err => {
  // 错误处理
})
```

不过，流式渲染在我们带来首屏性能提升的同时，也给我们带来了一些限制: **如果我们需要在 HTML 中填入一些与组件状态相关的内容，则不能使用流式渲染**。比如`react-helmet`中自定义的 head 内容，即便在渲染组件的时候收集到了 head 信息，但在流式渲染中，此时 HTML 的 head 部分已经发送给浏览器了，而这部分响应内容已经无法更改，因此 `react-helmet` 在 SSR 过程中将会失效。

### SSR 缓存

SSR 是一种典型的 CPU 密集型操作，为了尽可能降低线上机器的负载，设置缓存是一个非常重要的环节。在 SSR 运行时，缓存的内容可以分为这么几个部分:

1. 文件读取缓存。

```
function createMemoryFsRead() {
  const fileContentMap = new Map();
  return async (filePath) => {
    const cacheResult = fileContentMap.get(filePath);
    if (cacheResult) {
      return cacheResult;
    }
    const fileContent = await fs.readFile(filePath);
    fileContentMap.set(filePath, fileContent);
    return fileContent;
  }
}

const memoryFsRead = createMemoryFsRead();
memoryFsRead('file1');
// 直接复用缓存
memoryFsRead('file1');
```

2. 预取数据缓存
   对于某些实时性不高的接口数据，我们可以采取缓存的策略，在下次相同的请求进来时复用之前预取数据的结果，这样预取数据过程的各种 IO 消耗，也可以一定程度上减少首屏时间
3. HTML 渲染缓存
   拼接完成的`HTML`内容是缓存的重点，如果能将这部分进行缓存，那么下次命中缓存之后，将可以节省 `renderToString`、`HTML 拼接`等一系列的消耗，服务端的性能收益会比较明显
   对于以上的缓存内容，具体的缓存位置可以是：

- 1.  `服务器内存`。如果是放到内存中，需要考虑缓存淘汰机制，防止内存过大导致服务宕机，一个典型的缓存淘汰方案是 [lru-cache](https://link.juejin.cn?target=https%3A%2F%2Fgithub.com%2Fisaacs%2Fnode-lru-cache "https://github.com/isaacs/node-lru-cache") (基于 LRU 算法)。
- 2.  [Redis 数据库](https://link.juejin.cn?target=https%3A%2F%2Fgithub.com%2Fredis%2Fnode-redis "https://github.com/redis/node-redis")，相当于以传统后端服务器的设计思路来处理缓存。
- 3.  CDN 服务。我们可以将页面内容缓存到 CDN 服务上，在下一次相同的请求进来时，使用 CDN 上的缓存内容，而不用消费源服务器的资源。对于 CDN 上的 SSR 缓存，大家可以通过阅读[这篇文章](https://juejin.cn/post/6887884087915184141#heading-8 "https://juejin.cn/post/6887884087915184141#heading-8")深入了解。

> 需要补充的是，Vue 中另外实现了[组件级别的缓存](https://link.juejin.cn?target=https%3A%2F%2Fssr.vuejs.org%2Fzh%2Fguide%2Fcaching.html%23%25E7%25BB%2584%25E4%25BB%25B6%25E7%25BA%25A7%25E5%2588%25AB%25E7%25BC%2593%25E5%25AD%2598-component-level-caching "https://ssr.vuejs.org/zh/guide/caching.html#%E7%BB%84%E4%BB%B6%E7%BA%A7%E5%88%AB%E7%BC%93%E5%AD%98-component-level-caching")，这部分缓存一般放在内存中，可以实现更细粒度的 SSR 缓存。

### 性能监控

- SSR 产物加载时间
- 数据预取的时间
- 组件渲染的时间
- 服务端接受请求到响应的完整时间
- SSR 缓存命中情况
- SSR 成功率、错误日志

```
import { performance, PerformanceObserver } from 'perf_hooks';

// 初始化监听器逻辑
const perfObserver = new PerformanceObserver((items) => {
  items.getEntries().forEach(entry => {
    console.log('[performance]', entry.name, entry.duration.toFixed(2), 'ms');
  });
  performance.clearMarks();
});

perfObserver.observe({ entryTypes: ["measure"] })

// 接下来我们在 SSR 进行打点
// 以 renderToString  为例
performance.mark('render-start');
// renderToString 代码省略
performance.mark('render-end');
performance.measure('renderToString', 'render-start', 'render-end');
```

### SSG/ISR/SPR

1.SSG

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2cec0e552e1d4584957b95b0cad4df40~tplv-k3u1fbpfcp-watermark.image?)

```
// scripts/ssg.ts
// 以下的工具函数均可以从 SSR 流程复用
async function ssg() {
  // 1. 加载服务端入口
  const { ServerEntry, fetchData } = await loadSsrEntryModule(null);
  // 2. 数据预取
  const data = await fetchData();
  // 3. 组件渲染
  const appHtml = renderToString(React.createElement(ServerEntry, { data }));
  // 4. HTML 拼接
  const template = await resolveTemplatePath();
  const templateHtml = await fs.readFileSync(template, 'utf-8');
  const html = templateHtml
  .replace('<!-- SSR_APP -->', appHtml)
  .replace(
    '<!-- SSR_DATA -->',
    `<script>window.__SSR_DATA__=${JSON.stringify(data)}</script>`
  );
  // 最后，我们需要将 HTML 的内容写到磁盘中，将其作为构建产物
  fs.mkdirSync('./dist/client', { recursive: true });
  fs.writeFileSync('./dist/client/index.html', html);
}

ssg();
```

- `SPR`即`Serverless Pre Render`，即把 SSR 的服务部署到 Serverless(FaaS) 环境中，实现服务器实例的自动扩缩容，降低服务器运维的成本。

- `ISR`即`Incremental Site Rendering`，即增量站点渲染，将一部分的 SSG 逻辑从构建时搬到了 `SSR` 运行时，解决的是大量页面 SSG 构建耗时长的问题

## 总结

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6ac1671b0101498b8b0acf31a273e673~tplv-k3u1fbpfcp-watermark.image?)
