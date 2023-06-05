// src/index.jsx
// react-dom 的内容全部从 CDN 拉取
// 这段代码目前是无法运行的
import { render } from "https://cdn.skypack.dev/react-dom";
import React from "https://cdn.skypack.dev/react";

let Greet = () => <h1>Hello, lili!</h1>;

render(<Greet />, document.getElementById("root"));
