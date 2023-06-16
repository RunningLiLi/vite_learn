# vite 项目的性能优化

对于项目的加载性能优化而言，常见的优化手段可以分为下面三类:

1.  **网络优化**。包括 `HTTP2`、`DNS 预解析`、`Preload`、`Prefetch`等手段。
2.  **资源优化**。包括`构建产物分析`、`资源压缩`、`产物拆包`、`按需加载`等优化方式。
3.  **预渲染优化**，本文主要介绍`服务端渲染`(SSR)和`静态站点生成`(SSG)两种手段。

## 网络优化

### HTTP2

HTTP 1.1 协议中，**队头阻塞**和**请求排队**问题很容易成为网络层的性能瓶颈。而 HTTP 2 的诞生就是为了解决这些问题，它主要实现了如下的能力：

- **多路复用**。将数据分为多个二进制帧，多个请求和响应的数据帧在同一个 TCP 通道进行传输，解决了之前的队头阻塞问题。而与此同时，在 HTTP2 协议下，浏览器不再有同域名的并发请求数量限制，因此请求排队问题也得到了解决。
- **Server Push**，即服务端推送能力。可以让某些资源能够提前到达浏览器，比如对于一个 html 的请求，通过 HTTP 2 我们可以同时将相应的 js 和 css 资源推送到浏览器，省去了后续请求的开销。

`vite-plugin-mkcert`开启 http2

```
pnpm i vite-plugin-mkcert -D
```

```
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    // https 选项需要开启
    https: true,
  },
});
```

在生产环境中我们会对线上的服务器进行配置，从而开启 HTTP2 的能力，如 [Nginx 的 HTTP2 配置](https://link.juejin.cn?target=http%3A%2F%2Fnginx.org%2Fen%2Fdocs%2Fhttp%2Fngx_http_v2_module.html "http://nginx.org/en/docs/http/ngx_http_v2_module.html")

### DNS 预解析

```
//建立与服务器的连接，建立 TCP 通道及进行 TLS 握手，进一步降低请求延迟
<link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin>
//浏览器在向跨域的服务器发送请求时，首先会进行 DNS 解析，将服务器域名解析为对应的 IP 地址。我们通过 `dns-prefetch` 技术将这一过程提前，降低 DNS 解析的延迟时间
<link rel="dns-prefetch" href="https://fonts.gstatic.com/">
```

### Preload/Prefetch

preload
资源的预解析

```
<link rel="preload" href="style.css" as="style">
<link rel="preload" href="main.js" as="script">
```

与普通 script 标签不同的是，对于原生 ESM 模块，浏览器提供了`modulepreload`来进行预加载:

```
<link rel="modulepreload" href="/src/app.js" />
```

prefetch
它相当于告诉浏览器空闲的时候去预加载其它页面的资源，比如对于 A 页面中插入了这样的 `link` 标签:

```
<link rel="prefetch" href="https://B.com/index.js" as="script">
```

## 资源加载

### 产物分析报告

```
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      // 打包完成后自动打开浏览器，显示产物体积报告
      open: true,
    }),
  ],
});
```

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/625677a8227642bc88370ba15b99bc26~tplv-k3u1fbpfcp-watermark.image?)

### 资源压缩

js，css，图片都可以压缩

#### js 压缩

在 Vite 生产环境构建的过程中，JavaScript 产物代码会自动进行压缩，相关的配置参数如下:

```
// vite.config.ts
export default {
  build: {
    // 类型: boolean | 'esbuild' | 'terser'
    // 默认为 `esbuild`
    minify: 'esbuild',
    // 产物目标环境
    target: 'modules',
    // 如果 minify 为 terser，可以通过下面的参数配置具体行为
    // https://terser.org/docs/api-reference#minify-options
    terserOptions: {}
  }
}
```

### css 压缩

对于 CSS 代码的压缩，Vite 中的相关配置如下:

```

```

```
// vite.config.ts
export default {
  build: {
    // 设置 CSS 的目标环境
    cssTarget: ''
  }
}
```

默认情况下 Vite 会使用 Esbuild 对 CSS 代码进行压缩，一般不需要我们对 `cssTarget` 进行配置。

不过在需要兼容安卓端微信的 webview 时，我们需要将 `build.cssTarget`  设置为  `chrome61`，以防止 vite 将  `rgba()`  颜色转化为  `#RGBA`  十六进制符号的形式，出现样式问题。

### 图片压缩

图片资源是一般是产物体积的大头，如果能有效地压缩图片体积，那么对项目体积来说会得到不小的优化。而在 Vite 中我们一般使用 `vite-plugin-imagemin`来进行图片压缩，你可以去 [静态资源小节](https://juejin.cn/book/7050063811973218341/section/7058854154738860066 "https://juejin.cn/book/7050063811973218341/section/7058854154738860066") 查看使用方式和效果。

### 产物拆包

#### 不拆问题

- 1.  首屏加载的代码体积过大，即使是当前页面不需要的代码也会进行加载。
- 2.  线上**缓存复用率**极低，改动一行代码即可导致整个 bundle 产物缓存失效。

#### 默认拆包策略

- 1.  CSS 代码分割，即实现一个 chunk 对应一个 css 文件。
- 2.  默认有一套拆包策略，将应用的代码和第三方库的代码分别打包成两份产物，并对于动态 import 的模块单独打包成一个 chunk。
      > vite3 现在是把第三方包和应用打包到一个文件

#### 自定义配置

当然，我们也可以通过`manualChunks`参数进行自定义配置：

```

```

```
// vite.config.ts
{
  build {
    rollupOptions: {
      output: {
        // 1. 对象配置
        manualChunks: {
          // 将 React 相关库打包成单独的 chunk 中
          'react-vendor': ['react', 'react-dom'],
          // 将 Lodash 库的代码单独打包
          'lodash': ['lodash-es'],
          // 将组件库的代码打包
          'library': ['antd'],
        },
        // 2. 函数配置
          if (id.includes('antd') || id.includes('@arco-design/web-react')) {
            return 'library';
          }
          if (id.includes('lodash')) {
            return 'lodash';
          }
          if (id.includes('react')) {
            return 'react';
          }
      },
    }
  },
}
```

当然，在函数配置中，我们还需要注意循环引用的问题，具体细节你可以参考 [代码分割小节](https://juejin.cn/book/7050063811973218341/section/7066601785166659620 "https://juejin.cn/book/7050063811973218341/section/7066601785166659620") 的内容。

### 按需加载

一个比较好的方式是对路由组件进行动态引入，比如在 React 应用中使用 `@loadable/component` 进行组件异步加载:

```

```

```
import React from "react";
import ReactDOM from "react-dom";
import loadable from "@loadable/component";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Foo = loadable(() => import("./routes/Foo"));
const Bar = loadable(() => import("./routes/Bar"));

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/foo" element={<Foo />} />
        <Route path="/bar" element={<Bar />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById("root")
);
```

这样在生产环境中，Vite 也会将动态引入的组件单独打包成一个 Chunk。
当然，对于组件内部的逻辑，我们也可以通过动态 import 的方式来延迟执行，进一步优化首屏的加载性能，如下代码所示:

```
f## 预渲染优化unction App() {
  const computeFunc = async () => {
    // 延迟加载第三方库
    // 需要注意 Tree Shaking 问题
    // 如果直接引入包名，无法做到 Tree-Shaking，因此尽量导入具体的子路径
    const { default: merge } = await import("lodash-es/merge");
    const c = merge({ a: 1 }, { b: 2 });
    console.log(c);
  };
  return (
    <div className="App">
      <p>
        <button type="button" onClick={computeFunc}>
          Click me
        </button>
      </p>
    </div>
  );
}

export default App;
```

## 预渲染优化

预渲染是当今比较主流的优化手段，主要包括服务端渲染(SSR)和静态站点生成(SSG)这两种技术。

在 SSR 的场景下，服务端生成好**完整的 HTML 内容**，直接返回给浏览器，浏览器能够根据 HTML 渲染出完整的首屏内容，而不需要依赖 JS 的加载，从而降低浏览器的渲染压力；而另一方面，由于服务端的网络环境更优，可以更快地获取到页面所需的数据，也能节省浏览器请求数据的时间。

而 SSG 可以在构建阶段生成完整的 HTML 内容，它与 SSR 最大的不同在于 HTML 的生成在构建阶段完成，而不是在服务器的运行时。SSG 同样可以给浏览器完整的 HTML 内容，不依赖于 JS 的加载，可以有效提高页面加载性能。不过相比 SSR，SSG 的内容往往动态性不够，适合比较静态的站点，比如文档、博客等场景。
