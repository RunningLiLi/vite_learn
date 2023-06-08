import { defineConfig } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";
import path from "path";
import { alias } from "./plugins/alias.js";
import { image } from "./plugins/image.js";
export default defineConfig({
  input: "./src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
    plugins: [terser()],
  },
  // external: ["lodash-es"],
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript(),
    alias({
      "@src": path.resolve("./src"),
    }),
    image(),
  ],
});
