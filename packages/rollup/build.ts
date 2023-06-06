import { rollup, OutputOptions } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";
import * as process from "process";
rollup({
  input: "./src/index.ts",
  treeshake: true,
  plugins: [nodeResolve(), commonjs(), typescript()],
  external: ["lodash-es"],
}).then((res) => {
  const opt: OutputOptions = {
    dir: "dist",
    format: "iife",
    plugins: [terser()],
    globals: { "lodash-es": "_" },
  };
  res.generate(opt);
  res.write(opt);
  // res
  //   .generate({
  //     dir: "dist",
  //   })
  //   .then((res) => {
  //     console.log(res);
  //   });
});
