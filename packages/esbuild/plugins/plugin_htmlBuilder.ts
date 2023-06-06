import { build, Plugin } from "esbuild";
import { cdnPlugin } from "./plugin_cdnImport";
import * as fs from "fs";
import * as path from "path";
const htmlPlugin: Plugin = {
  name: "htmlPlugin",
  setup(build) {
    build.onEnd((args) => {
      console.log(args);
      if (!args.metafile) throw new Error("请开启metafile选项");
      let scripts = Object.keys(args.metafile.outputs).reduce((pre, cur) => {
        return pre + createScript(cur.replace(/.*\//, "")) + "\n";
      }, "\n");
      let html = "";
      fs.readFile(path.resolve(__dirname, "../index.html"), (err, data) => {
        if (err) throw new Error(err.message);
        else {
          html += data.toString().replace("<body>", "<body>" + scripts);
          fs.writeFile(
            path.resolve(__dirname, "../dist/index.html"),
            html,
            () => {
              console.log("html生成完成");
            }
          );
        }
      });
    });
  },
};
function createScript(src: string): string {
  return `<script src="${src}" type="module"></script>`;
}
function createLink(href: string): string {
  return `<link href="${href}">`;
}
build({
  entryPoints: ["./src/index.jsx"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  splitting: true,
  plugins: [cdnPlugin, htmlPlugin],
  metafile: true,
});
