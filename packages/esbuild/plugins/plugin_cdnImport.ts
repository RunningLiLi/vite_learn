import { build, Plugin } from "esbuild";
import { get } from "http";
import { get as gets } from "https";
export const cdnPlugin: Plugin = {
  name: "cdnPlugin",
  setup: (build) => {
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: "http-url",
    }));
    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
      return {
        // 重写路径
        path: new URL(args.path, args.importer).toString(),
        namespace: "http-url",
      };
    });
    build.onLoad({ filter: /.*/, namespace: "http-url" }, (args) => {
      return new Promise((resolve, reject) => {
        function fetch(url: string) {
          console.log(`Downloading: ${url}`);
          let lib = url.startsWith("https") ? gets : get;
          let req = lib(url, (res) => {
            if ([301, 302, 307].includes(res.statusCode as number)) {
              // 重定向
              fetch(new URL(res.headers.location as string, url).toString());
              req.destroy();
            } else if (res.statusCode === 200) {
              // 响应成功
              let chunks: any[] = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => resolve({ contents: Buffer.concat(chunks) }));
            } else {
              reject(new Error(`GET ${url} failed: status ${res.statusCode}`));
            }
          }).on("error", reject);
        }
        fetch(args.path);
      });
    });
  },
};
// build({
//   absWorkingDir: process.cwd(),
//   entryPoints: ["../src/index.jsx"],
//   outdir: "dist",
//   bundle: true,
//   format: "esm",
//   splitting: true,
//   sourcemap: true,
//   metafile: true,
//   plugins: [cdnPlugin],
// }).then(() => {});
