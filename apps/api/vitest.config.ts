import { defineConfig } from "vitest/config";

// Carrega o banco e segredos de teste antes de qualquer import da aplicação
process.loadEnvFile(".env.test");

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Os testes compartilham o mesmo banco: rodar arquivos em série evita interferência
    fileParallelism: false,
  },
});
