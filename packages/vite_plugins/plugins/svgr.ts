import { Plugin } from "vite";
import * as fs from "fs";
import * as resolve from "resolve";
import { transform } from "@svgr/core";
interface SvgrOptions {
  defaultExport: "url" | "component";
}

export default function viteSvgrPlugin(options: SvgrOptions): Plugin {
  const { defaultExport = "component" } = options;

  return {
    name: "vite-plugin-svgr",
    async transform(code, id) {
      // 1. 根据 id 入参过滤出 svg 资源；

      if (!id.endsWith(".svg")) {
        return code;
      }
      // 解析 esbuild 的路径，后续转译 jsx 会用到，我们这里直接拿 vite 中的 esbuild 即可
      const esbuildPackagePath = resolve.sync("esbuild", {
        basedir: require.resolve("vite"),
      });
      const esbuild = require(esbuildPackagePath);
      // 2. 读取 svg 文件内容；
      const svg = await fs.promises.readFile(id, "utf8");

      // 3. 利用 `@svgr/core` 将 svg 转换为 React 组件代码
      const svgrResult = transform.sync(
        svg,
        { plugins: ["@svgr/plugin-jsx"] },
        { componentName: "ReactComponent" }
      );
      console.log(svgrResult == svg);
      // 4. 处理默认导出为 url 的情况
      let componentCode = svgrResult;
      if (defaultExport === "url") {
        // 加上 Vite 默认的 `export default 资源路径`
        componentCode += code;
        componentCode = componentCode.replace(
          "export default ReactComponent",
          "export { ReactComponent }"
        );
      }
      // console.log(componentCode);
      // 5. 利用 esbuild，将组件中的 jsx 代码转译为浏览器可运行的代码;
      const result = await esbuild.transform(componentCode, {
        loader: "jsx",
      });
      console.log(result.code);
      return {
        code: result.code,
        map: null, // TODO
      };
    },
  };
}
