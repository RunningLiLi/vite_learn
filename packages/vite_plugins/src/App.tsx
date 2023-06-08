import "./App.css";
import fib from "virtual:fib";
import hello from "virtual:hello";
import env from "virtual:env";
import url, { ReactComponent as Logo } from "./assets/react.svg";
function App() {
  return (
    <>
      <img src={url} />
      <Logo></Logo>
      {fib(10)}
      {hello()}
      {env()}
    </>
  );
}

export default App;
