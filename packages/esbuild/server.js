const { build, context } = require("esbuild");

function runBuild() {
  context({
    absWorkingDir: process.cwd(),
    entryPoints: ["./src/index.jsx"],
    bundle: true,
    format: "esm",
    splitting: true,
    sourcemap: true,
    ignoreAnnotations: true,
    metafile: true,
    outdir: "dist",
  }).then((server) => {
    server
      .serve({
        port: 8000,
        // 静态资源目录
        servedir: "./dist",
      })
      .then((server) => {
        console.log("HTTP Server starts at port", server.host + server.port);
      });
  });
}

runBuild();
