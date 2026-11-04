// Torna um email administrador e define a senha dele. A senha é digitada no
// terminal (sem eco), nunca passada como argumento, para não ficar no histórico.
//   pnpm admin:create voce@exemplo.com
import { createInterface } from "node:readline/promises";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { registerSchema } from "@tributoleao/shared";
import { BCRYPT_ROUNDS } from "../src/routes/auth";

const prisma = new PrismaClient();

async function ask(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** Lê uma linha sem mostrar o que é digitado. */
function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error("Rode este comando em um terminal interativo para digitar a senha.");
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") process.exit(130); // Ctrl+C
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = registerSchema.shape.email.parse(process.argv[2] ?? (await ask("Email do admin: ")));
  const existing = await prisma.user.findUnique({ where: { email } });
  const name = existing?.name ?? registerSchema.shape.name.parse(await ask("Nome: "));

  const password = registerSchema.shape.password.parse(await askHidden("Senha (mín. 8 caracteres): "));
  if ((await askHidden("Confirme a senha: ")) !== password) throw new Error("As senhas não conferem.");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, passwordHash },
    create: { name, email, role: UserRole.ADMIN, passwordHash },
  });
  console.log(`${email} agora é administrador ${existing ? "(senha atualizada)" : "(conta criada)"}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
