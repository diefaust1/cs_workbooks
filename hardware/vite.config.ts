import { resolve } from "node:path";
import { defineConfig } from "vite";

const frontend = resolve(import.meta.dirname, "frontend");

export default defineConfig({
  root: frontend,
  input: {
    index: resolve(frontend, "index.html"),
    cpu: resolve(frontend, "cpu.html"),
    gpu: resolve(frontend, "gpu.html"),
    memory: resolve(frontend, "memory.html"),
    bus: resolve(frontend, "bus.html"),
    wrup: resolve(frontend, "wrup.html"),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    modulePreload: false,
  },
});
