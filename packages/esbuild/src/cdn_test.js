import Server from "react-dom/server";

let Greet = () => <h1>Hello, lili111!</h1>;
console.log(Server.renderToString(<Greet />));
