import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss(), webExtension({ manifest: "manifest.json" })],
});
