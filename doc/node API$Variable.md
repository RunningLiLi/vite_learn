# node API|Variable

## process.cwd（）

Node.js 命令或脚本，`process.cwd()` 就返回该目录的路径。

## \_\_dirname

表示当前模块所在的目录路径

## url.fileURLToPath

用于将文件 URL 转换为文件路径

```
const { fileURLToPath } = require('url');

const fileURL = 'file:///path/to/file.js';
const filePath = fileURLToPath(fileURL);
console.log(filePath); // 输出: /path/to/file.js
```

## pathToFileURL

将绝对路径转换为文件 url

```ts
const entryPath = path.join(cwd, "dist/server/entry-server.js");
return import(pathToFileURL(entryPath).href);
```
