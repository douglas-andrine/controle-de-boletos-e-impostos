import { buildApp } from "./app";
import { env } from "./env";

const app = await buildApp();

try {
  // 0.0.0.0 é necessário no Render (o container expõe a porta externamente)
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
