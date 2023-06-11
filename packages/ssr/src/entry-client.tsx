import "./index.css";
import App from "./App";
import { hydrateRoot } from "react-dom/client";

// @ts-ignore
const data = window.__SSR_DATA__;
const root = document.querySelector("#root");
if (root) hydrateRoot(root, <App data={data} />);
