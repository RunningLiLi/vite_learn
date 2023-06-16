# vite(HMR)

很久之前，我们是通过 live reload 也就是自动刷新页面的方式来解决的。不过随着前端工程的日益庞大，开发场景也越来越复杂，这种`live reload`的方式在诸多的场景下却显得十分鸡肋，简单来说就是`模块局部更新`+`状态保存`的需求在`live reload`的方案没有得到满足

## 深入 HMR API

HMR 的技术我们就可以实现`局部刷新`和`状态保存`

```ts
interface ImportMeta {
  readonly hot?: {
    readonly data: any;
    accept(): void;
    accept(cb: (mod: any) => void): void;
    accept(dep: string, cb: (mod: any) => void): void;
    accept(deps: string[], cb: (mods: any[]) => void): void;
    prune(cb: () => void): void;
    dispose(cb: (data: any) => void): void;
    decline(): void;
    invalidate(): void;
    on(event: string, cb: (...args: any[]) => void): void;
  };
}
```

### 模块更新时逻辑: hot.accept

用来**接受模块更新**

- 接受**自身模块**的更新
- 接受**某个子模块**的更新
- 接受**多个子模块**的更新
  相当于拦截了代码变动导致页面刷新，而且将怎么刷新的过程交给我们

#### **1. 接受自身更新**

```
import.meta.hot.accept((mod) => mod.render())
```

#### **2. 接受依赖模块的更新**

```
// main.ts
import { render } from './render';
import './state';
render();
+if (import.meta.hot) {
+  import.meta.hot.accept('./render.ts', (newModule) => {
+    newModule.render();
+  })
+}
```

#### **3. 接受多个子模块的更新**

```
// main.ts
import { render } from './render';
import { initState } from './state';
render();
initState();
if (import.meta.hot) {
  import.meta.hot.accept(['./render.ts', './state.ts'], (modules) => {
    // 自定义更新
    const [renderModule, stateModule] = modules;
    if (renderModule) {
      renderModule.render();
    }
    if (stateModule) {
      stateModule.initState();
    }
  })
}
```

### 模块销毁时逻辑: hot.dispose

```
// state.ts
let timer: number | undefined;
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (timer) {
      clearInterval(timer);
    }
  })
}
export function initState() {
  let count = 0;
  timer = setInterval(() => {
    let countEle = document.getElementById('count');
    countEle!.innerText =  ++count + '';
  }, 1000);
}
```

### 共享数据: hot.data 属性

```
if (import.meta.hot) {
import.meta.hot.accept((mod) => mod.state());
}
let timer = null;
import.meta.hot.dispose(() => {
    clearInterval(timer);
});
export function state() {
    let num = import.meta.hot.data?.num || 0;
    const counter = document.querySelector("#counter");
    timer = setInterval(() => {
        counter.innerHTML = "" + num--;
        import.meta.hot.data.num = num;
}, 1000);
}
```

## 其他

### **1. import.meta.hot.invalidate()**

强制页面刷新

### 自定义事件

![图片.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0eddefce33d746cf8f8edf5fa83af4c9~tplv-k3u1fbpfcp-watermark.image?)
