// src/index.jsx
// react-dom 的内容全部从 CDN 拉取
// 这段代码目前是无法运行的
import { render } from "https://cdn.skypack.dev/react-dom";
import React from "https://cdn.skypack.dev/react";
// const HtmlTest = import("./html_test");
import HtmlTest from "./html_test";
let Greet = () => <h1>Hello, lili!</h1>;

render(
  <HtmlTest>
    <Greet />
  </HtmlTest>,
  document.getElementById("root")
);
