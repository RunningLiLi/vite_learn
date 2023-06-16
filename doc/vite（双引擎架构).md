# vite（双引擎架构)

esbuild+rollup

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9290b8516ca54bccaf5abe00da05a218~tplv-k3u1fbpfcp-watermark.image?)

## esbuild（快快快！）

1. 预构建
   打包还是 rollup（功能更丰富，生态好）
2. 作为 TS,JSX 的编译工具（dev&&prod）
3. 代码压缩（prod）

## Rollup

1.打包

- css 代码分割
- 自动预加载
- 异步 Chunk 加载优化

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c4256cbce8784f25acfe7e6eb33a581d~tplv-k3u1fbpfcp-watermark.image?)

## 兼容插件机制

vite 兼容 rollup 插件
