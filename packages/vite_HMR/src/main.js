import { render } from "./render.js";
import { max } from "lodash-es";
import { min } from "lodash";
render();
import("./state").then((module) => {
  module.state();
});
console.log(max([1, 2, 3]), min([1, 2, 3]));
