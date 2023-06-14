import { max } from "lodash-es";
export function setupCounter(element: HTMLButtonElement) {
  let counter = 0;
  const setCounter = (count: number) => {
    counter = count;
    element.innerHTML = `count is ${counter}`;
  };
  element.addEventListener("click", () =>
    setCounter(max([counter + 1, counter + 2]) as number)
  );
  setCounter(0);
}
