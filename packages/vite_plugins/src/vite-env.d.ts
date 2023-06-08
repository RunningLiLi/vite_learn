/// <reference types="vite/client" />
declare module "virtual:*" {
  export default any;
}
declare module "*.svg" {
  export { ReactComponent };
}
