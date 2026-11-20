// Mede só as rotas de fornecedores (mesmas condições do cenário de volume: 10 conexões, 8 s)
import autocannon from "autocannon";
import { execFileSync } from "node:child_process";
const tok = (u) => execFileSync("node", [new URL("./tok.cjs", import.meta.url).pathname, u]).toString().trim();
const run = (o) => new Promise((res, rej) => autocannon({ timeout: 30, connections: 10, duration: 8, ...o }, (e, r) => (e ? rej(e) : res(r))));
for (const u of ["vol_1k", "vol_10k", "vol_100k", "vol_500k"]) {
  for (const [name, path] of [["fornecedores p1", "/suppliers?page=1&pageSize=20"], ["fornecedores busca", "/suppliers?search=razao%2042"], ["fornecedor detalhe", `/suppliers/${u}_s1`]]) {
    const r = await run({ url: "http://localhost:3399" + path, headers: { cookie: `tl_session=${tok(u)}` } });
    console.log(JSON.stringify({ u, name, rps: Math.round(r.requests.average), p50: r.latency.p50, p99: r.latency.p99, ok: r["2xx"], non2xx: r.non2xx, errors: r.errors }));
  }
}
