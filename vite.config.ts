import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    // Search runs in the deployed Cloud Function (functions/src/search.ts).
    proxy: {
      "/api": { target: "https://stuff-11062.web.app", changeOrigin: true },
    },
  },
});
