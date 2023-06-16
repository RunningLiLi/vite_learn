# monorepe 怎么配合 lint-staged

https://www.npmjs.com/package/lint-staged#how-to-use-lint-staged-in-a-multi-package-monorepo

**大概就是直接输入命令，例如 eslint --fix,对于不同的暂存文件，会采用最近的配置文件，这样 monorepe 包下的每一个仓库都可以自定义配置，如果某些仓库不想执行这个命令，使用 global pattern 来排除某些文件**
就像这样，只对路径有 vite 的文件执行！

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c995f29a385c42d5921c196bffbb8205~tplv-k3u1fbpfcp-watermark.image?)

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c1b0da7b3cc4c34bb724d948d5d2d87~tplv-k3u1fbpfcp-watermark.image?)
