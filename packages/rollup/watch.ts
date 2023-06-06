import { watch } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";
const watcher = watch({
  input: "./src/index.ts",
  treeshake: true,
  plugins: [nodeResolve(), commonjs(), typescript()],
  external: "lodash-es",
  output: {
    dir: "dist",
    format: "esm",
    plugins: [terser()],
  },
  watch: {
    exclude: ["node_modules/**"],
    include: ["src/**"],
  },
});
// 监听 watch 各种事件
watcher.on("restart", () => {
  console.log("重新构建...");
});

watcher.on("change", (id) => {
  console.log("发生变动的模块id: ", id);
});

watcher.on("event", (e) => {
  if (e.code === "BUNDLE_END") {
    console.log("打包信息:", e);
  }
});
