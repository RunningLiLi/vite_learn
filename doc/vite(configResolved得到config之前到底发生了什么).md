# vite(configResolved 得到 config 之前到底发生了什么)

## 1.加载配置文件

```
// 这里的 config 是命令行指定的配置，如 vite --configFile=xxx
let { configFile } = config
if (configFile !== false) {
  // 默认都会走到下面加载配置文件的逻辑，除非你手动指定 configFile 为 false
  const loadResult = await loadConfigFromFile(
    configEnv,
    configFile,
    config.root,
    config.logLevel
  )
  if (loadResult) {
    // 解析配置文件的内容后，和命令行配置合并
    config = mergeConfig(loadResult.config, config)
    configFile = loadResult.path
    configFileDependencies = loadResult.dependencies
  }
}
```

1. 加载配置文件
2. 合并命令行配置

## 2.解析用户插件

```
// resolve plugins
const rawUserPlugins = (config.plugins || []).flat().filter((p) => {
  if (!p) {
    return false
  } else if (!p.apply) {
    return true
  } else if (typeof p.apply === 'function') {
     // apply 为一个函数的情况
    return p.apply({ ...config, mode }, configEnv)
  } else {
    return p.apply === command
  }
}) as Plugin[]
// 对用户插件进行排序
const [prePlugins, normalPlugins, postPlugins] =
  sortUserPlugins(rawUserPlugins)
```

```
// run config hooks
const userPlugins = [...prePlugins, ...normalPlugins, ...postPlugins]
for (const p of userPlugins) {
  if (p.config) {
    const res = await p.config(config, configEnv)
    if (res) {
      // mergeConfig 为具体的配置合并函数，大家有兴趣可以阅读一下实现
      config = mergeConfig(config, res)
    }
  }
}
```

1. 通过 `apply 参数` 过滤出需要生效的用户插件。
2. 对用户插件进行排序（按顺序执行）

![图片.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02d247c955874faca3d5d8d05d6b8f8c~tplv-k3u1fbpfcp-watermark.image?)

3. 接着，Vite 会拿到这些过滤且排序完成的插件，依次调用插件 config 钩子，进行配置合并。（这里全部初始配置完成，后面都是一些添加和修改）
4. 然后解析项目的根目录即 `root` 参数，默认取 `process.cwd()`的结果
5. `alias` ，这里需要加上一些内置的 alias 规则，如`@vite/env`、`@vite/client`这种直接重定向到 Vite 内部的模块

## 3.加载环境变量

```
// load .env files
const envDir = config.envDir
  ? normalizePath(path.resolve(resolvedRoot, config.envDir))
  : resolvedRoot
const userEnv =
  inlineConfig.envFile !== false &&
  loadEnv(mode, envDir, resolveEnvPrefix(config))
```

loadEnv 其实就是扫描 `process.env` 与 `.env`文件，解析出 env 对象，值得注意的是，这个对象的属性最终会被挂载到`import.meta.env` 这个全局对象上。

1. loadEnv(此后的 hook 才能拿到 env)
2. 资源公共路径即`base URL`
3. `cacheDir`的解析
4. 处理用户配置的`assetsInclude`

## 4. 路径解析器工厂

```
const createResolver: ResolvedConfig['createResolver'] = (options) => {
  let aliasContainer: PluginContainer | undefined
  let resolverContainer: PluginContainer | undefined
  // 返回的函数可以理解为一个解析器
  return async (id, importer, aliasOnly, ssr) => {
    let container: PluginContainer
    if (aliasOnly) {
      container =
        aliasContainer ||
        // 新建 aliasContainer
    } else {
      container =
        resolverContainer ||
        // 新建 resolveContainer
    }
    return (await container.resolveId(id, importer, undefined, ssr))?.id
  }
}
```

## 5. 生成插件流水线

```
;(resolved.plugins as Plugin[]) = await resolvePlugins(
  resolved,
  prePlugins,
  normalPlugins,
  postPlugins
)

// call configResolved hooks
await Promise.all(userPlugins.map((p) => p.configResolved?.(resolved)))
```

先生成完整插件列表传给`resolve.plugins`，而后调用每个插件的 `configResolved` 钩子函数。

## 加载配置文件详解

```
const loadResult = await loadConfigFromFile(/*省略传参*/)
```

### 1. 识别配置文件的类别

以上这种先编译配置文件，再将产物写入临时目录，最后加载临时目录产物的做法，也是 AOT (Ahead Of Time)编译技术的一种具体实现。
首先 Vite 会检查项目的 package.json ，如果有`type: "module"`则打上 `isESM` 的标识

```
try {
  const pkg = lookupFile(configRoot, ['package.json'])
  if (pkg && JSON.parse(pkg).type === 'module') {
    isMjs = true
  }
} catch (e) {}
```

```
let isTS = false
let isESM = false
let dependencies: string[] = []
// 如果命令行有指定配置文件路径
if (configFile) {
  resolvedPath = path.resolve(configFile)
  // 根据后缀判断是否为 ts 或者 esm，打上 flag
  isTS = configFile.endsWith('.ts')
  if (configFile.endsWith('.mjs')) {
      isESM = true
    }
} else {
  // 从项目根目录寻找配置文件路径，寻找顺序:
  // - vite.config.js
  // - vite.config.mjs
  // - vite.config.ts
  // - vite.config.cjs
  const jsconfigFile = path.resolve(configRoot, 'vite.config.js')
  if (fs.existsSync(jsconfigFile)) {
    resolvedPath = jsconfigFile
  }

  if (!resolvedPath) {
    const mjsconfigFile = path.resolve(configRoot, 'vite.config.mjs')
    if (fs.existsSync(mjsconfigFile)) {
      resolvedPath = mjsconfigFile
      isESM = true
    }
  }

  if (!resolvedPath) {
    const tsconfigFile = path.resolve(configRoot, 'vite.config.ts')
    if (fs.existsSync(tsconfigFile)) {
      resolvedPath = tsconfigFile
      isTS = true
    }
  }

  if (!resolvedPath) {
    const cjsConfigFile = path.resolve(configRoot, 'vite.config.cjs')
    if (fs.existsSync(cjsConfigFile)) {
      resolvedPath = cjsConfigFile
      isESM = false
    }
  }
}
```

### 2. 根据类别解析配置

- ESM

```
let userConfig: UserConfigExport | undefined

if (isESM) {
  const fileUrl = require('url').pathToFileURL(resolvedPath)
  // 首先对代码进行打包
  const bundled = await bundleConfigFile(resolvedPath, true)
  dependencies = bundled.dependencies
  // TS + ESM
  if (isTS) {
    fs.writeFileSync(resolvedPath + '.js', bundled.code)
    userConfig = (await dynamicImport(`${fileUrl}.js?t=${Date.now()}`))
      .default
    fs.unlinkSync(resolvedPath + '.js')
    debug(`TS + native esm config loaded in ${getTime()}`, fileUrl)
  }
  //  JS + ESM
  else {
    userConfig = (await dynamicImport(`${fileUrl}?t=${Date.now()}`)).default### CommonJS 格式
    debug(`native esm config loaded in ${getTime()}`, fileUrl)
  }
}
```

以上这种先编译配置文件，再将产物写入临时目录，最后加载临时目录产物的做法，也是 AOT (Ahead Of Time)编译技术的一种具体实现。

```
export const dynamicImport = new Function('file', 'return import(file)')
```

你可能会问，为什么要用 new Function 包裹？这是为了避免打包工具处理这段代码，比如 `Rollup` 和 `TSC`，类似的手段还有 `eval`。

你可能还会问，为什么 import 路径结果要加上时间戳 query？这其实是为了让 dev server 重启后仍然读取最新的配置，避免缓存。

- CommonJS 格式

```
// 对于 js/ts 均生效
// 使用 esbuild 将配置文件编译成 commonjs 格式的 bundle 文件
const bundled = await bundleConfigFile(resolvedPath)
dependencies = bundled.dependencies
// 加载编译后的 bundle 代码
userConfig = await loadConfigFromBundledFile(resolvedPath, bundled.code)
```

```
async function loadConfigFromBundledFile(
  fileName: string,
  bundledCode: string
): Promise<UserConfig> {
  const extension = path.extname(fileName)
  const defaultLoader = require.extensions[extension]!
  require.extensions[extension] = (module: NodeModule, filename: string) => {
    if (filename === fileName) {
      ;(module as NodeModuleWithCompile)._compile(bundledCode, filename)
    } else {
      defaultLoader(module, filename)
    }
  }
  // 清除 require 缓存
  delete require.cache[require.resolve(fileName)]
  const raw = require(fileName)
  const config = raw.__esModule ? raw.default : raw
  require.extensions[extension] = defaultLoader
  return config
}
```

```
Module.prototype._compile = function (content, filename) {
  var self = this
  var args = [self.exports, require, self, filename, dirname]
  return compiledWrapper.apply(self.exports, args)
}
```

> 这种运行时加载 TS 配置的方式，也叫做 `JIT`(即时编译)，这种方式和 `AOT` 最大的区别在于不会将内存中计算出来的 js 代码写入磁盘再加载，而是通过拦截 Node.js 原生 require.extension 方法实现即时加载。
