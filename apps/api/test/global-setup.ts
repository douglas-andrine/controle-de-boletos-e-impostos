import { execSync } from "node:child_process";

// Cria o banco de testes (se preciso) e aplica as migrations antes da suíte.
export default function setup() {
  execSync("pnpm prisma migrate deploy", { stdio: "inherit", env: process.env });
}
