import App from "./App";
import "./index.css";

function ServerEntry({ data }: { data: string }) {
  return <App data={data} />;
}

export { ServerEntry };
