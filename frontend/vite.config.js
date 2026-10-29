import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localTranscriptPlugin } from "./vite-transcript-plugin";
export default defineConfig({
    plugins: [react(), localTranscriptPlugin()],
    server: {
        port: 5173,
    },
});
