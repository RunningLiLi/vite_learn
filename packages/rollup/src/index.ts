import { add } from "./utils";
import { debounce } from "lodash-es";
console.log(debounce(() => add(1, 3)));
