import { defineConfig } from "vite";
import federation from "@originjs/vite-plugin-federation";
export default defineConfig({
  build: {
    target: "esnext",
    minify: false,
    terserOptions: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
  plugins: [
    federation({
      name: "mf2",
      remotes: {
        mf1: {
          externalType: "url",
          external: "http://localhost:4173/assets/remoteEntry.js",
        },
      },
      shared: ["lodash-es"],
    }),
  ],
});
