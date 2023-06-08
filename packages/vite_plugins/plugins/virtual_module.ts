import { Plugin, ResolvedConfig } from "vite";
const resolvedIds = ["virtual:fib", "virtual:hello", "virtual:env"];
export default function (): Plugin {
  let config: ResolvedConfig | null = null;
  return {
    name: "vite-plugin-virtual-module",
    resolveId(id) {
      if (resolvedIds.includes(id)) {
        return "\0" + id;
      }
    },
    configResolved(c) {
      config = c;
    },
    load(id) {
      const index = resolvedIds.findIndex((item) => id == "\0" + item);
      if (index == -1) return null;
      const key = resolvedIds[index].split(":")[1];
      switch (key) {
        case "fib":
          return `export default  function fib(num){if(num<0)return 0;if(num==1||num==2){return 1;}else{return fib(num-1)+fib(num-2);}}`;
        case "hello":
          return `export default ()=>"hello world"`;
        case "env":
          return `export default ()=>'${JSON.stringify(config.env)}'`;
      }
    },
  };
}
