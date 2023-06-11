// src/ssr-server/index.ts
// 后端服务
import express from "express";
import { createSsrMiddleware } from "./middleware.ts";
async function createServer() {
  const app = express();
  app.use(await createSsrMiddleware(app));
  app.listen(3000, () => {
    console.log("Node 服务器已启动~");
    console.log("http://localhost:3000");
  });
}

createServer();
