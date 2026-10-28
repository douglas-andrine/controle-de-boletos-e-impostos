import { setDefaultResultOrder } from "node:dns";
import { buildApp } from "./app";
import { env } from "./env";

// Em redes sem saída IPv6, o fetch do Node tenta o endereço IPv6 do Google
// primeiro e estoura o tempo antes de cair no IPv4 (login com Google falhava).
setDefaultResultOrder("ipv4first");

const app = await buildApp();

try {
  // 0.0.0.0 é necessário no Render (o container expõe a porta externamente)
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
