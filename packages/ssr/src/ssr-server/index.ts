// src/ssr-server/index.ts
// 后端服务
import express from "express";
import { createSsrMiddleware } from "./middleware.ts";
import serveStatic from "serve-static";
import path from "path";
const isProd = process.env.NODE_ENV === "production";
async function createServer() {
  const app = express();
  app.use(await createSsrMiddleware(app));
  isProd && app.use(serveStatic(path.join(process.cwd(), "dist/client")));
  app.listen(3000, () => {
    console.log("Node 服务器已启动~");
    console.log("http://localhost:3000");
  });
}

createServer();
