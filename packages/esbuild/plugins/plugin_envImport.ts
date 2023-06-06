// const esbuild = require("esbuild");
import { build, Plugin } from "esbuild";
import * as process from "process";
const envPlugin: Plugin = {
  name: "envPlugin",
  setup(build) {
    build.onResolve({ filter: /^env$/ }, (args) => {
      console.log("resolve", args);
      return {
        namespace: "envImport",
        path: args.path,
      };
    });
    build.onLoad({ filter: /.*/, namespace: "envImport" }, (args) => {
      console.log("load", args);
      return {
        contents: JSON.stringify(process.env),
        loader: "json",
      };
    });
    build.onEnd((args) => {
      console.log(args);
    });
  },
};
build({
  outdir: "dist",
  entryPoints: ["../src/env_test.js"],
  bundle: true,
  plugins: [envPlugin],
  metafile: true,
});
