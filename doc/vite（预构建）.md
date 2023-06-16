# vite（预构建）

采用 esbuild 进行依赖预构建

## 为什么需要

1. 第 3 方包规范不确定，需要将 commonjs->ESM
2. 请求瀑布流（lodash）

## 开启

1. 自动开启
   第一次启动项目，自动开启

- package.json 的 `dependencies` 字段
- 各种包管理器的 lock 文件
- `optimizeDeps` 配置内容
  都不变则一直使用缓存

2. 手动开启

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ada4ca8c2dcc4d56937154a13bf1601e~tplv-k3u1fbpfcp-watermark.image?)

## 自定义配置

### 入口文件——entries

```
// vite.config.ts
{
  optimizeDeps: {
    // 为一个字符串数组
    entries: ["./src/main.vue"];
  }
}
```

### 添加一些依赖——include

```
// vite.config.ts
optimizeDeps: {
  // 配置为一个字符串数组，将 `lodash-es` 和 `vue`两个包强制进行预构建
  include: ["lodash-es", "vue"];
}
```

#### 场景一: 动态 import

```
// src/locales/zh_CN.js
import objectAssign from "object-assign";
console.log(objectAssign);

// main.tsx
const importModule = (m) => import(`./locales/${m}.ts`);
importModule("zh_CN");
```

如果不手动 include，会触发二次预构建，会拖慢加载速度

#### 场景二: 某些包被手动 exclude

exlcude 不需要预构建的包

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/271f13171da64a1ebc4eb7720f0f3853~tplv-k3u1fbpfcp-watermark.image?)

### 自定义 Esbuild 行为

```
// vite.config.ts
{
  optimizeDeps: {
    esbuildOptions: {
       plugins: [
        // 加入 Esbuild 插件
      ];
    }
  }
}
```

#### 为了处理特殊情况: 第三方包出现问题怎么办？

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d70d8b2698484aee9fc87df1c1442efd~tplv-k3u1fbpfcp-watermark.image?)

##### 1.改第三方代码

```
pnpm i @milahu/patch-package -D
```

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/16a76303b4ca4bba89f64f423eb2a0d5~tplv-k3u1fbpfcp-watermark.image?)

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e12cf9d883cb4a619306c85174964574~tplv-k3u1fbpfcp-watermark.image?)
也可以这样

![图片.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e08d1c39ae7d4154ad304ec8b76ebe58~tplv-k3u1fbpfcp-watermark.image?)

##### 2. 加入 Esbuild 插件

```
// vite.config.ts
const esbuildPatchPlugin = {
  name: "react-virtualized-patch",
  setup(build) {
    build.onLoad(
      {
        filter:
          /react-virtualized/dist/es/WindowScroller/utils/onScroll.js$/,
      },
      async (args) => {
        const text = await fs.promises.readFile(args.path, "utf8");

        return {
          contents: text.replace(
            'import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js";',
            ""
          ),
        };
      }
    );
  },
};

// 插件加入 Vite 预构建配置
{
  optimizeDeps: {
    esbuildOptions: {
      plugins: [esbuildPatchPlugin];
    }
  }
}
```
