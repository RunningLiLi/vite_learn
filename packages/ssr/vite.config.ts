import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "http://localhost:63342/vite_learn/packages/ssr/dist/client/",
  plugins: [react()],
});
