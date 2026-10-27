import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // O pacote shared é TypeScript puro: embutimos no bundle em vez de publicá-lo.
  noExternal: ["@tributoleao/shared"],
});
