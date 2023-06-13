import { defineConfig } from "vite";
import federation from "@originjs/vite-plugin-federation";
export default defineConfig({
  build: {
    target: "es2015",
    minify: false,
  },
  plugins: [
    federation({
      name: "mf1",
      filename: "remoteEntry.js",
      exposes: {
        "./Counter": "./src/counter.ts",
      },
    }),
  ],
});
