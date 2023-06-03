import "./index.module.scss"
// import styles from "./index.module.css"
import styled from 'styled-components';
import { css } from '@emotion/css'
function App() {

  const color = 'white'
  const Wrapper = styled.section`
  padding: 4em;
  background: papayawhip;
`;
  return <Wrapper><h1 className={css`
      padding: 32px;
      background-color: hotpink;
      font-size: 24px;
      border-radius: 4px;
      &:hover {
        color: ${color};
      }
    `}>hello world</h1></Wrapper>
}

export default App
