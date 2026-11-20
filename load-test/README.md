# Teste de carga — TributoLeão (20/11/2026)

Tudo rodou **local**, num banco separado (`tributoleao_load`, no container do `docker-compose`), com a API buildada (`dist/server.js`, `NODE_ENV=production`). Produção (Vercel, Render e Supabase) **não** foi tocada.

## Massa de dados

| Usuário | Fornecedores | Boletos | Impostos |
|---|---:|---:|---:|
| `vol_1k` | 100 | 1.000 | 1.000 |
| `vol_10k` | 500 | 10.000 | 10.000 |
| `vol_100k` | 2.000 | 100.000 | 100.000 |
| `vol_500k` | 5.000 | 500.000 | 500.000 |
| `conc_1` … `conc_200` (cada) | 50 | 300 | 300 |
| **Total no banco** | **17.600** | **671.000** | **671.000** |

Vencimentos espalhados de jan/2025 a dez/2027. O que já venceu está ~75% pago e o restante está atrasado.

## 1. Acessos simultâneos

São 200 usuários diferentes com uma mistura parecida com o uso real: 25% dashboard, 35% listas de boletos e impostos, 18% fornecedores, 7% relatório, 5% busca e 10% **criação de boleto**. Cada nível rodou por 20 s.

### Máquina local (12 núcleos, sem limite)

| Conexões simultâneas | Req/s | p50 | p90 | p99 | Erros |
|---:|---:|---:|---:|---:|---:|
| 10 | 297 | 23 ms | 87 ms | 174 ms | 0 |
| 50 | 325 | 136 ms | 226 ms | 368 ms | 0 |
| 100 | 320 | 264 ms | 454 ms | 718 ms | 0 |
| 200 | 313 | 536 ms | 757 ms | 1,3 s | 0 |
| 500 | 316 | 442 ms | 686 ms | 8,3 s | 0 |
| 1000 | 277 | 512 ms | 992 ms | 13,6 s | 0 |

### Simulando o Render free (0,1 CPU e 512 MB, via `systemd-run`)

| Conexões simultâneas | Req/s | p50 | p90 | p99 | Erros |
|---:|---:|---:|---:|---:|---:|
| 10 | 12 | 0,8 s | 1,1 s | 1,7 s | 0 |
| 50 | 13 | 2,5 s | 3,7 s | 16 s | 0 |
| 100 | 12 | 3,0 s | 6,1 s | 19 s | 0 |
| 200 | 8 | 2,2 s | 8,5 s | 19 s | 0 |
| 500 | 2 | — | 18 s | 19 s | 0 |
| 1000 | 0 | — | — | — | 187 conexões recusadas |

A partir de 200 conexões, as requisições ainda pendentes ao fim dos 20 s não entram na conta. Por isso o p50 desses níveis parece melhor do que é.

**Conclusão:** a API é estável. Não houve nenhum 5xx, a memória não estourou e nenhum dado se misturou entre usuários. Também não houve falha de escrita: todos os boletos criados no teste voltaram 201. O limite é de vazão, não de quebra: localmente o teto fica em torno de **300 req/s**. No plano gratuito do Render, a estimativa é de **~12 req/s**. Uma tela do app dispara de 2 a 4 requisições, então isso dá **cerca de 3 a 5 pessoas clicando ao mesmo tempo** com resposta abaixo de 1–2 s. Acima disso tudo fica em fila, e a partir de ~1000 conexões o servidor recusa conexões.

## 2. Muitos registros num único usuário

São 10 conexões simultâneas por 8 s em cada rota. Os números são da máquina local; no Render free tudo fica bem mais lento.

| Rota | 1k | 10k | 100k | 500k |
|---|---:|---:|---:|---:|
| Dashboard | 40 ms | 53 ms | 274 ms | **2,6 s** |
| Boletos, pág. 1 | 18 ms | 19 ms | 26 ms | 52 ms |
| Boletos, última pág. (100/pág.) | 70 ms | 84 ms | 224 ms | 767 ms |
| Boletos atrasados | 18 ms | 20 ms | 35 ms | 121 ms |
| Boletos, busca por texto | 27 ms | 49 ms | 287 ms | **1,0 s** |
| Impostos, pág. 1 | 33 ms | 41 ms | 127 ms | 619 ms |
| Fornecedores, pág. 1 | **175 ms** | **178 ms** | **185 ms** | **197 ms** |
| Fornecedores, busca | 178 ms | 190 ms | 191 ms | 248 ms |
| Fornecedores, options (sem paginação) | 2 ms | 8 ms | 30 ms (175 KB) | 82 ms (441 KB) |
| Relatório de boletos do mês | 21 ms | 191 ms (127 KB) | **2,1 s (1,3 MB)** | **> 8 s (6,6 MB)** |
| Relatório de impostos do mês | 36 ms | 346 ms (125 KB) | **3,3 s (1,3 MB)** | **> 8 s** |

Valores em p50. "> 8 s" quer dizer que nenhuma resposta terminou dentro da janela. Sozinho, sem concorrência, o relatório de 500k leva 1,5 s.

**Conclusão:** até ~10 mil boletos e 10 mil impostos por usuário, tudo responde em menos de 350 ms. Isso equivale a uma empresa com ~200 boletos por mês durante 4 anos. Os problemas começam perto de 100 mil registros e ficam sérios com 500 mil.

## 3. Gargalos encontrados (por prioridade)

1. **Listagem de fornecedores varre a tabela de boletos e impostos de todos os usuários.** O `include: { _count: { select: { boletos, taxes } } }` em `apps/api/src/routes/suppliers.ts` faz o Prisma gerar `LEFT JOIN (SELECT "supplierId", COUNT(*) FROM boletos WHERE 1=1 GROUP BY "supplierId")`, sem filtrar pelo usuário (confirmado no log do Postgres). Por isso a rota leva ~180 ms até para quem tem 100 fornecedores. Ela também é o maior gargalo da mistura de carga, e **piora conforme a plataforma inteira cresce**, não só o usuário. Correção: contar com `groupBy` filtrando pelos `id`s da página, ou com SQL que filtre `userId`.
2. **Relatórios não têm limite.** Um mês com 13,7 mil boletos gera um JSON de 6,6 MB e trava a API por segundos. No Render free, isso pode derrubar a instância por memória ou tempo. Correção: limitar o período ou a quantidade, ou calcular os totais no banco e paginar os itens.
3. **Dashboard faz ~20 consultas por requisição**, várias delas agregando todo o histórico do usuário (`status` sem índice). Com 500 mil registros chega a 2,6 s. Correção: índice `(userId, status, dueDate)` em `boletos` e `taxes`, e/ou juntar os agregados em 1–2 SQL com `FILTER`.
4. **A busca por texto usa `ILIKE '%termo%'`** em boletos e nos fornecedores ligados, sem índice. Leva 1 s com 500 mil. Correção: índice `pg_trgm` ou buscar os fornecedores antes.
5. **`count(*)` e `OFFSET` nas listas** (impostos pág. 1 com 619 ms e última página com 767 ms em 500k) só pesam em volumes que um usuário real dificilmente atinge. Prioridade baixa.
6. **Vazão no Render free (~12 req/s)** é limite de infraestrutura, não de código. Os itens 1 e 3 aliviam bastante. Para mais gente simultânea, a saída é um plano pago ou várias instâncias.

## 4. Correção do gargalo nº 1 (20/11)

`apps/api/src/routes/suppliers.ts` agora conta boletos e impostos com `groupBy` filtrado pelos `id`s dos fornecedores da página, usando o índice `supplierId`, no lugar de `include: { _count }`. A mudança vale para a listagem, o detalhe, a edição e o bloqueio de exclusão. A resposta (`boletoCount`) não mudou. Entraram 2 testes novos: contagem certa por página sem misturar usuários e exclusão bloqueada por imposto. A suíte inteira passa (103 testes).

### Rotas de fornecedores (10 conexões, local)

| Rota | Antes (p50 · req/s) | Depois (p50 · req/s) |
|---|---:|---:|
| Fornecedores, pág. 1, vol_1k | 175 ms · 53 | 6 ms · 1.462 |
| Fornecedores, pág. 1, vol_500k | 197 ms · 48 | 7 ms · 1.314 |
| Fornecedores, busca, vol_1k | 178 ms · 55 | 5 ms · 1.867 |
| Fornecedores, busca, vol_500k | 248 ms · 39 | 20 ms · 491 |
| Detalhe do fornecedor, vol_500k | — | 3 ms · 2.765 |

### Carga mista com 200 usuários

| Conexões | Local antes | Local depois | Render free antes | Render free depois |
|---:|---:|---:|---:|---:|
| 10 | 297 req/s · p90 87 ms | 369 req/s · p90 35 ms | 12 req/s | 11 req/s |
| 100 | 320 req/s · p90 454 ms | 369 req/s · p90 323 ms | 12 req/s | 12 req/s |
| 1000 | 277 req/s · p90 992 ms | 341 req/s · p90 533 ms | conexões recusadas | conexões recusadas |

Localmente a vazão geral subiu ~15%. Agora o dashboard é o que mais pesa. Na simulação do Render free nada mudou, porque o limite ali é a CPU da própria API (0,1 CPU), e o Postgres local roda sem limite. A correção tira trabalho do **banco**. Em produção, o Supabase gratuito também tem CPU limitada e é compartilhado, então o efeito deve ser maior lá. Isso **não foi medido**.

## Não testado

- Produção (Vercel, Render e Supabase). A latência de rede até o Supabase e o pooler `pgbouncer` com `connection_limit` não entraram no teste, e o Postgres local rodou sem limite de CPU. Os números do "Render free" valem só para a API.
- Hibernação do Render (cold start de até ~1 min, já documentado).
- Upload de comprovantes no Storage.
- Login e cadastro: têm rate limit de 10 por minuto. O teste usa JWT assinado direto com o segredo do `load.env`.
- Front-end: renderização de listas grandes ou do relatório de 6,6 MB no navegador.

## Como rodar de novo

```bash
pnpm db:up
cd load-test && pnpm install
# crie load.env (fica fora do git) com NODE_ENV=production, PORT=3399,
# DATABASE_URL/DIRECT_URL apontando para .../tributoleao_load e um JWT_SECRET próprio
# o migrate deploy cria o banco tributoleao_load se ele não existir
(cd ../apps/api && set -a && . ../../load-test/load.env && set +a && pnpm exec prisma migrate deploy && pnpm build)
docker exec -i tributoleao-db psql -U tributo -d tributoleao_load < seed.sql
(cd ../apps/api && node --env-file=../../load-test/load.env dist/server.js > /dev/null) &
node load.mjs volume local
node load.mjs concurrency local
# Render free: rode a API com systemd-run --user --scope -p CPUQuota=10% -p MemoryMax=512M node ...
```
