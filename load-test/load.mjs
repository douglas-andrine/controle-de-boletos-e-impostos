// Teste de carga do TributoLeão contra a API local (porta 3399, banco tributoleao_load).
// Uso: node load.mjs concurrency | volume
import autocannon from "autocannon";
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3399";
const env = Object.fromEntries(
  readFileSync(new URL("./load.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(sub) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, iat: now, exp: now + 3600 })}`;
  return `${body}.${createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url")}`;
}
const cookie = (sub) => `tl_session=${token(sub)}`;

function run(opts) {
  return new Promise((resolve, reject) => {
    const inst = autocannon({ url: BASE, timeout: 30, ...opts }, (err, r) => (err ? reject(err) : resolve(r)));
    autocannon.track(inst, { renderProgressBar: false, renderResultsTable: false, renderLatencyTable: false });
  });
}
const summary = (name, r, extra = {}) => ({
  name,
  connections: r.connections,
  rps: Math.round(r.requests.average),
  total: r.requests.total,
  p50: r.latency.p50,
  p90: r.latency.p90,
  p99: r.latency.p99,
  max: r.latency.max,
  errors: r.errors,
  timeouts: r.timeouts,
  non2xx: r.non2xx,
  kbPerReq: r.requests.total ? Math.round(r.throughput.total / r.requests.total / 1024) : 0,
  ...extra,
});

// ---------- Cenário 1: muitos usuários diferentes ao mesmo tempo ----------
// Mistura parecida com o uso real: muita leitura (dashboard, listas), um pouco de escrita.
const MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function mixedRequest() {
  const u = `conc_${1 + Math.floor(Math.random() * 200)}`;
  const headers = { cookie: cookie(u), "content-type": "application/json" };
  const r = Math.random();
  if (r < 0.25) return { method: "GET", path: `/dashboard/stats?month=${pick(MONTHS)}`, headers };
  if (r < 0.45) return { method: "GET", path: `/boletos?page=${1 + Math.floor(Math.random() * 5)}&pageSize=20`, headers };
  if (r < 0.60) return { method: "GET", path: `/taxes?page=1&pageSize=20&status=${pick(["PENDENTE", "PAGO", "ATRASADO"])}`, headers };
  if (r < 0.70) return { method: "GET", path: `/suppliers?page=1&pageSize=20`, headers };
  if (r < 0.78) return { method: "GET", path: `/suppliers/options`, headers };
  if (r < 0.85) return { method: "GET", path: `/reports/boletos?month=${pick(MONTHS)}`, headers };
  if (r < 0.90) return { method: "GET", path: `/boletos?search=Fornecedor%201`, headers };
  // 10% escrita: cria boleto
  const body = JSON.stringify({
    supplierId: `${u}_s${1 + Math.floor(Math.random() * 50)}`,
    amountCents: 1000 + Math.floor(Math.random() * 100000),
    dueDate: `2026-12-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
  });
  return { method: "POST", path: "/boletos", headers, body };
}

async function concurrency() {
  const out = [];
  for (const c of [10, 50, 100, 200, 500, 1000]) {
    const r = await run({ connections: c, duration: 20, requests: [{ setupRequest: (req) => ({ ...req, ...mixedRequest() }) }] });
    const s = summary("misto", r);
    out.push(s);
    console.log(JSON.stringify(s));
  }
  return out;
}

// ---------- Cenário 2: um usuário com muitos registros ----------
async function volume() {
  const users = [["vol_1k", 1000], ["vol_10k", 10000], ["vol_100k", 100000], ["vol_500k", 500000]];
  const endpoints = (n) => [
    ["dashboard", "/dashboard/stats?month=2026-11"],
    ["boletos p1", "/boletos?page=1&pageSize=20"],
    ["boletos última pág", `/boletos?page=${Math.ceil(n / 100)}&pageSize=100`],
    ["boletos atrasados", "/boletos?status=ATRASADO&pageSize=20"],
    ["boletos busca", "/boletos?search=fornecedor%2042&pageSize=20"],
    ["impostos p1", "/taxes?page=1&pageSize=20"],
    ["fornecedores p1", "/suppliers?page=1&pageSize=20"],
    ["fornecedores busca", "/suppliers?search=razao%2042"],
    ["fornecedores options", "/suppliers/options"],
    ["relatório boletos mês", "/reports/boletos?month=2026-11"],
    ["relatório impostos mês", "/reports/taxes?month=2026-11"],
  ];
  const out = [];
  for (const [u, n] of users) {
    const headers = { cookie: cookie(u) };
    for (const [name, path] of endpoints(n)) {
      const r = await run({ url: BASE + path, connections: 10, duration: 8, headers });
      const s = summary(name, r, { user: u, records: n });
      out.push(s);
      console.log(JSON.stringify(s));
    }
  }
  return out;
}

const mode = process.argv[2];
const label = process.argv[3] ?? "local";
const result = mode === "volume" ? await volume() : await concurrency();
writeFileSync(new URL(`./result-${mode}-${label}.json`, import.meta.url), JSON.stringify(result, null, 2));
