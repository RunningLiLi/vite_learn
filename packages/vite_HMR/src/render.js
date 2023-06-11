if (import.meta.hot) {
  import.meta.hot.accept((mod) => mod.render());
}
export function render() {
  document.querySelector("#root").append("Hello World1");
}
console.log("render");
