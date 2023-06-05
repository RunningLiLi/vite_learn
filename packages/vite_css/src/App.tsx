import "./index.module.scss";
// import styles from "./index.module.css"
import styled from "styled-components";
import { css } from "@emotion/css";

function App() {
  const color = "white";
  const Wrapper = styled.section`
    padding: 4em;
    background: papayawhip;
  `;
  return (
    <Wrapper>
      <h1
        className={css`
          padding: 32px;
          background-color: hotpink;
          font-size: 24px;
          border-radius: 4px;
          &:hover {
            color: ${color};
          }
        `}
      >
        hello world
      </h1>
      <h2
        // bg="blue-400 hover:blue-500 dark:blue-500 dark:hover:blue-600"
        className="font-bold text-2xl mb-2"
      >
        hello windicss
      </h2>
      <h2 className="bg-amber-200">hello test global pattern</h2>
    </Wrapper>
  );
}

export default App;
