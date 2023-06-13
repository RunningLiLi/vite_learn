import { RequestHandler, Express } from "express";
import { ViteDevServer } from "vite";
import React from "react";
import ReactDOM from "react-dom/server";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
const isProd = process.env.NODE_ENV === "production";
const cwd = process.cwd();

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
    if (req.originalUrl !== "/") {
      return next();
    }
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
async function loadSsrEntryModule(vite: ViteDevServer | null) {
  // 生产模式下直接 require 打包后的产物
  if (isProd) {
    const entryPath = path.join(cwd, "dist/server/entry-server.js");
    return import(pathToFileURL(entryPath).href);
  }
  // 开发环境下通过 no-bundle 方式加载
  else {
    const entryPath = path.join(cwd, "src/entry-server.tsx");
    return vite?.ssrLoadModule(entryPath);
  }
}
async function preFetch() {
  return {
    data: "我是预渲染的数据",
  };
}
function resolveTemplatePath() {
  return isProd
    ? path.join(cwd, "dist/client/index.html")
    : path.join(cwd, "index.html");
}
async function spliceHtml(
  appHtml: string,
  url: string,
  vite: ViteDevServer | null,
  data: { data: string }
) {
  // 4. 拼接完整 HTML 字符串，返回客户端
  const templatePath = resolveTemplatePath();
  let template = fs.readFileSync(templatePath, "utf-8");
  // 开发模式下需要注入 HMR、环境变量相关的代码，因此需要调用 vite.transformIndexHtml
  if (!isProd && vite) {
    template = await vite.transformIndexHtml(url, template);
  }
  const html = template
    .replace("<!-- SSR_APP -->", appHtml)
    // 注入数据标签，用于客户端 hydrate
    .replace(
      "<!-- SSR_DATA -->",
      `<script>window.__SSR_DATA__=${JSON.stringify(data.data)}</script>`
    );
  return html;
}
