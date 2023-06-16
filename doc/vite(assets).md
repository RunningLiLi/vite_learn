# vite(assets)

静态资源问题 1.资源加载 2.生产性能

## 图片加载

### 使用场景

1.

```
<img src="../../assets/a.png"></img>
```

2.

```
background: url('../../assets/b.png') norepeat;
```

3.

```
document.getElementById('hero-img').src = '../../asset/c.png'
```

### vite 中使用

别名

```
// vite.config.ts
import path from 'path';

{
  resolve: {
    // 别名配置
    alias: {
      '@assets': path.join(__dirname, 'src/assets')
    }
  }
}
```

以上 3 中情况都可以

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/43e3cf509f5443898d4ce831c022b051~tplv-k3u1fbpfcp-watermark.image?)

### SVG 加载

```
// vite.config.ts
import svgr from 'vite-plugin-svgr';

{
  plugins: [
    // 其它插件省略
    svgr()
  ]
}
```

```
//ts.config.json
{
  "compilerOptions": {
    // 省略其它配置
    "types": ["vite-plugin-svgr/client"]
  }
}
```

```
import { ReactComponent as ReactLogo } from '@assets/icons/logo.svg';

export function Header() {
  return (
    // 其他组件内容省略
     <ReactLogo />
  )
}
```

### JSON

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8f1a675bbd30437e8c3f0e4467ffda09~tplv-k3u1fbpfcp-watermark.image?)

### worker

```
import Worker from './example.js?worker';
// 1. 初始化 Worker 实例
const worker = new Worker();
// 2. 主线程监听 worker 的信息
worker.addEventListener('message', (e) => {
  console.log(e);
});
```

### Web Assembly 文件

```
// Header/index.tsx
import init from './fib.wasm';

type FibFunc = (num: number) => number;

init({}).then((exports) => {
  const fibFunc = exports.fib as FibFunc;
  console.log('Fib result:', fibFunc(10));
});
```

### 其他

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/164adbde2a3b4f57a3959dbcfdc19bce~tplv-k3u1fbpfcp-watermark.image?)

### 特殊资源后缀

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5fcab4c7d56e4ab5bf87e9a487448c4e~tplv-k3u1fbpfcp-watermark.image?)

## 生产

### 1. 自定义部署域名

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f73c66417a2342fa9166b266db5b038c~tplv-k3u1fbpfcp-watermark.image?)
单独使用其他域名

```
<img src={new URL('./logo.png', import.meta.env.VITE_IMG_BASE_URL).href} />
```

定义.env.development .env.production,使用同一变量，在开发和生产阶段静态替换

### 2. 单文件 or 内联

```
// vite.config.ts
{
  build: {
    // 8 KB
    assetsInlineLimit: 8 * 1024
  }
}
```

### 3.图片压缩

```
pnpm i vite-plugin-imagemin -D
```

```
//vite.config.ts
import viteImagemin from 'vite-plugin-imagemin';

{
  plugins: [
    // 忽略前面的插件
    viteImagemin({
      // 无损压缩配置，无损压缩下图片质量不会变差
      optipng: {
        optimizationLevel: 7
      },
      // 有损压缩配置，有损压缩下图片质量可能会变差
      pngquant: {
        quality: [0.8, 0.9],
      },
      // svg 优化
      svgo: {
        plugins: [
          {
            name: 'removeViewBox'
          },
          {
            name: 'removeEmptyAttrs',
            active: false
          }
        ]
      }
    })
  ]
}
```

### 雪碧图

批量导入语法糖

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4387eb08f2154ae9b1724dd1d6e251ce~tplv-k3u1fbpfcp-watermark.image?)

```
pnpm i vite-plugin-svg-icons -D
```

```
// vite.config.ts
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

{
  plugins: [
    // 省略其它插件
    createSvgIconsPlugin({
      iconDirs: [path.join(__dirname, 'src/assets/icons')]
    })
  ]
}
```

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5ff7d905e89944c1aae41d1c962290e4~tplv-k3u1fbpfcp-watermark.image?)
