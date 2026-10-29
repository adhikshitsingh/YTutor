import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localTranscriptPlugin } from "./vite-transcript-plugin";

export default defineConfig({
  plugins: [react(), localTranscriptPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
