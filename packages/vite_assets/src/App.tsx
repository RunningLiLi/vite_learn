import React, { useEffect, useRef, useState } from "react";
import { ReactComponent as ReactLogo } from "@assets/react.svg";
import reactLogo from "@assets/react.svg?raw";
import viteLogo from "/vite.svg";
import "./App.css";
const svgs = import.meta.glob<{
  ReactComponent: React.FunctionComponent; //通过插件生产的组件svg
  default: string; //路径
}>("../public/*.svg", { eager: true });
console.log(svgs);
function App() {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.src = reactLogo;
    }
  }, []);
  return (
    <>
      {/*<div>*/}
      {/*  {Object.values(svgs).map(({ ReactComponent }) => {*/}
      {/*    return <ReactComponent />;*/}
      {/*  })}*/}
      {/*</div>*/}
      <div>
        {Object.values(svgs).map((item) => {
          const symbolId =
            "#icon-" + item.default.split("/").at(-1)?.split(".")[0];
          return (
            <svg aria-hidden="true">
              <use href={symbolId} fill={"#333"} />
            </svg>
          );
        })}
      </div>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <ReactLogo></ReactLogo>
          <img src={reactLogo} className="logo" alt="React logo" />
        </a>
      </div>
      <h1>{import.meta.env.VITE_BASE_URL}</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">test global pattern</p>
    </>
  );
}

export default App;
