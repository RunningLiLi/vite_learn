# vite（code splitting）

## 问题

- 按需加载
- 线上缓存

## vite 默认拆包

```
.
├── assets
│   ├── Dynamic.3df51f7a.js    // Async Chunk
│   ├── Dynamic.f2cbf023.css   // Async Chunk (CSS)
│   ├── favicon.17e50649.svg   // 静态资源
│   ├── index.1e236845.css     // Initial Chunk (CSS)
│   ├── index.6773c114.js      // Initial Chunk
│   └── vendor.ab4b9e1f.js     // 第三方包产物 Chunk
└── index.html                 // 入口 HTML
```

- css 代码分割
- 业务代码一个 chunk（index）
- 第三方包一个 chunk（vendor）
- 动态引入的文件一个 chunk
  > vite3 后将 index 和 vernder 打包成一个文件

## 自定义拆包策略

### manualChunks 对象配置

```
// vite.config.ts
{
  build: {
    rollupOptions: {
      output: {
        // manualChunks 配置
        manualChunks: {
          // 将 React 相关库打包成单独的 chunk 中
          'react-vendor': ['react', 'react-dom'],
          // 将 Lodash 库的代码单独打包
          'lodash': ['lodash-es'],
          // 将组件库的代码打包
          'library': ['antd', '@arco-design/web-react'],
        },
      },
    }
  },
}
```

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ee472188141841c3896212dc18883cec~tplv-k3u1fbpfcp-watermark.image?)

### manualChunks 函数配置

#### 循环引用

```
manualChunks(id) {
  if (id.includes('antd') || id.includes('@arco-design/web-react')) {
    return 'library';
  }
  if (id.includes('lodash')) {
    return 'lodash';
  }
  if (id.includes('react')) {
    return 'react';
  }
}
```

![图片.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3e6c5ef407ef4e9e97ef875b748aee5c~tplv-k3u1fbpfcp-watermark.image?)
这是循环代码

```
// react-vendor.e2c4883f.js
import { q as objectAssign } from "./index.37a7b2eb.js";

// index.37a7b2eb.js
import { R as React } from "./react-vendor.e2c4883f.js";
```

> 因为只是判断有没有用关键字子串，如果 3 方包引用了没有关键字，则不会打包进入相应 chunk，而进入 index，所以导致循环引入。

> 判断条件，不能只是单纯判断有没有关键字字串，而是判断包名是不是第三包的引入的包或者本身

```
// 确定 react 相关包的入口路径
const chunkGroups = {
  'react-vendor': [
    require.resolve('react'),
    require.resolve('react-dom')
  ],
}

// Vite 中的 manualChunks 配置
function manualChunks(id, { getModuleInfo }) {
  for (const group of Object.keys(chunkGroups)) {
    const deps = chunkGroups[group];
    if (
      id.includes('node_modules') &&
      // 递归向上查找引用者，检查是否命中 chunkGroups 声明的包
      isDepInclude(id, deps, [], getModuleInfo)
     ) {
      return group;
    }
  }
}
```

```
// 缓存对象
const cache = new Map();

function isDepInclude (id: string, depPaths: string[], importChain: string[], getModuleInfo): boolean | undefined  {
  const key = `${id}-${depPaths.join('|')}`;
  // 出现循环依赖，不考虑
  if (importChain.includes(id)) {
    cache.set(key, false);
    return false;
  }
  // 验证缓存
  if (cache.has(key)) {
    return cache.get(key);
  }
  // 命中依赖列表
  if (depPaths.includes(id)) {
    // 引用链中的文件都记录到缓存中
    importChain.forEach(item => cache.set(`${item}-${depPaths.join('|')}`, true));
    return true;
  }
  const moduleInfo = getModuleInfo(id);
  if (!moduleInfo || !moduleInfo.importers) {
    cache.set(key, false);
    return false;
  }
  // 核心逻辑，递归查找上层引用者
  const isInclude = moduleInfo.importers.some(
    importer => isDepInclude(importer, depPaths, importChain.concat(id), getModuleInfo)
  );
  // 设置缓存
  cache.set(key, isInclude);
  return isInclude;
};
```

## 终极解决方案

`vite-plugin-chunk-split`

```
// vite.config.ts
import { chunkSplitPlugin } from 'vite-plugin-chunk-split';

export default {
  chunkSplitPlugin({
    // 指定拆包策略
    customSplitting: {
      // 1. 支持填包名。`react` 和 `react-dom` 会被打包到一个名为`render-vendor`的 chunk 里面(包括它们的依赖，如 object-assign)
      'react-vendor': ['react', 'react-dom'],
      // 2. 支持填正则表达式。src 中 components 和 utils 下的所有文件被会被打包为`component-util`的 chunk 中
      'components-util': [/src/components/, /src/utils/]
    }
  })
}
```
