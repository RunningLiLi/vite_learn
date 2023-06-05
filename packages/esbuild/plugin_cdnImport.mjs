import { build } from "esbuild";
import http from "http";
import https from "https";
const cdnPlugin = {
  name: "cdnPlugin",
  "setup":(build)=> {
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: "http-url",
    }));
    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) =>{
      console.log(args)
      return({
      // 重写路径
      path: new URL(args.path, args.importer).toString(),
      namespace: "http-url",
    })});
    build.onLoad({ filter: /.*/, namespace: "http-url" }, (args) => {
      return new Promise((resolve, reject) => {
        function fetch(url) {
          console.log(`Downloading: ${url}`);
          let lib = url.startsWith("https") ? https : http;
          let req = lib
            .get(url, (res) => {
              if ([301, 302, 307].includes(res.statusCode)) {
                // 重定向
                fetch(new URL(res.headers.location, url).toString());
                req.destroy();
              } else if (res.statusCode === 200) {
                // 响应成功
                let chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () =>
                  resolve({ contents: Buffer.concat(chunks) })
                );
              } else {
                reject(
                  new Error(`GET ${url} failed: status ${res.statusCode}`)
                );
              }
            })
            .on("error", reject);
        }
        fetch(args.path);
      });
    });
  },
};
build({
  absWorkingDir: process.cwd(),
  entryPoints: ["./src/index.jsx"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  splitting: true,
  sourcemap: true,
  metafile: true,
  plugins:[cdnPlugin]
}).then(()=>{});
