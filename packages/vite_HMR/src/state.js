if (import.meta.hot) {
  import.meta.hot.accept((mod) => mod.state());
}
// import.meta.hot.invalidate();
let timer;
import.meta.hot.dispose(() => {
  clearInterval(timer);
});
export function state() {
  let num = import.meta.hot.data?.num || 0;
  const counter = document.querySelector("#counter");
  timer = setInterval(() => {
    counter.innerHTML = "" + num--;
    import.meta.hot.data.num = num;
  }, 1000);
}
