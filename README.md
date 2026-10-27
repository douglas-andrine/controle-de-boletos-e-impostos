# TributoLeão

Sistema web de gestão financeira para controle de **boletos**, **tributos** e **fornecedores**, com foco em evitar atrasos em obrigações fiscais e pagamentos operacionais.

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, Lucide |
| Backend | Node.js, Fastify 5, TypeScript, Zod |
| Banco | PostgreSQL + Prisma ORM |
| Compartilhado | `packages/shared`: schemas Zod, validação de CPF/CNPJ, dinheiro e status |
| Deploy | Vercel (web) · Render (api) · Supabase (Postgres + Storage) |

## Estrutura

```
apps/
  api/        API Fastify + Prisma (schema, migrations, seed)
  web/        SPA React
packages/
  shared/     Código usado pelo front e pelo back
```

## Decisões de projeto

- **Valores em centavos (inteiros)** para evitar erros de ponto flutuante.
- **Status "Atrasado" é derivado**, não persistido: o banco guarda `PENDENTE`/`PAGO` e o atraso é calculado pela data de vencimento no fuso `America/Sao_Paulo`.
- **Mesma origem em produção**: a Vercel faz rewrite de `/api/*` para a API no Render, permitindo cookies HTTP-only sem problemas de cookies de terceiros.
- **Dados isolados por usuário**: toda entidade pertence a um `userId`.

## Telas

| Tela | Destaques |
|---|---|
| **Dashboard** | KPIs do mês, alerta de atrasos, agenda dos próximos 15 dias com copiar código e dar baixa (com desfazer), distribuição impostos vs. boletos |
| **Impostos** | Filtros por status e período de apuração, valor em R$, baixa com data de pagamento, estorno |
| **Boletos** | Filtros por status, fornecedor e mês de vencimento; valor + juros/multa com total ao vivo; baixa e estorno |
| **Fornecedores** | Busca por nome ou CPF/CNPJ, máscaras, histórico de boletos por fornecedor, exclusão protegida |

Filtros e paginação ficam na URL (links compartilháveis) e todas as telas funcionam no celular.

## Autenticação

- Cadastro e login com email/senha (hash **bcrypt**), validados pelos mesmos schemas Zod no front e na API.
- Sessão em **JWT dentro de cookie HTTP-only** (`SameSite=Lax`, `Secure` em produção): o token nunca fica acessível ao JavaScript.
- Login com email inexistente e senha errada têm a mesma resposta e o mesmo tempo, o que evita descobrir emails cadastrados.
- **Rate limit** de 10 tentativas/minuto nas rotas de autenticação.
- Botão **"Entrar como demonstração"**: cria sob demanda um usuário demo com dados fictícios.

| Rota | Descrição |
|---|---|
| `POST /auth/register` | Cria a conta e abre a sessão |
| `POST /auth/login` | Login com email e senha |
| `POST /auth/demo` | Entra como usuário de demonstração |
| `POST /auth/logout` | Encerra a sessão |
| `GET /auth/me` | Retorna o usuário logado |

## API de cadastros

Todas as rotas exigem sessão e só enxergam os dados do usuário logado: o recurso de outro usuário responde `404`.

| Recurso | Rotas |
|---|---|
| Fornecedores | `GET/POST /suppliers` · `GET/PUT/DELETE /suppliers/:id` |
| Impostos | `GET/POST /taxes` · `GET/PUT/DELETE /taxes/:id` · `PATCH /taxes/:id/pay` · `PATCH /taxes/:id/unpay` |
| Boletos | `GET/POST /boletos` · `GET/PUT/DELETE /boletos/:id` · `PATCH /boletos/:id/pay` · `PATCH /boletos/:id/unpay` |

- **Listagens paginadas**: `?page=1&pageSize=20`, com resposta `{ data, meta: { page, pageSize, total, totalPages } }`.
- **Filtros**:
  - `search` em todas as listagens; em fornecedores, aceita nome ou CPF/CNPJ com ou sem máscara.
  - Impostos e boletos: `status` (`PENDENTE`, `PAGO`, `ATRASADO`), `dueFrom` e `dueTo` (intervalo de vencimento).
  - Impostos: `referenceMonth=AAAA-MM`. Boletos: `supplierId`.
- **Baixa de pagamento**: `PATCH /:id/pay` aceita `{ "paidAt": "AAAA-MM-DD" }` opcional (padrão: hoje). `unpay` estorna baixas feitas por engano.
- **Fornecedor com boletos não pode ser excluído** (`409`), para preservar o histórico financeiro.

## Dashboard

`GET /dashboard/stats?month=AAAA-MM` (padrão: mês atual) devolve os KPIs calculados com agregações no banco:

| Campo | KPI |
|---|---|
| `monthTotals.pendingCents` | **Total a pagar no mês**: impostos + boletos não pagos com vencimento no mês |
| `taxesYearToDate` | **Total acumulado de impostos** no ano, separado em pago e pendente |
| `pendingBoletos` | **Boletos pendentes**: quantidade, valor e quantos já estão atrasados |
| `nextDue` | **Próximo vencimento urgente** a partir de hoje, com o código de pagamento |
| `overdue` | Quantidade e valor de tudo que está atrasado |
| `agenda` | Atrasados + vencimentos dos próximos 15 dias (até 10 itens), com dias até o vencimento |
| `distribution` | Impostos vs. boletos operacionais no mês, em valor e percentual |

## Rodando localmente

Pré-requisitos: Node 20.19+, pnpm 10 e Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # e defina um JWT_SECRET
pnpm db:up        # Postgres local na porta 5434
pnpm db:migrate   # aplica as migrations
pnpm db:seed      # cria o usuário demo com dados fictícios
pnpm dev          # web em http://localhost:5173 · api em http://localhost:3333
```

Usuário de demonstração: `demo@tributoleao.app` / `demo1234`.

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe front e API em modo watch |
| `pnpm build` | Build de produção de todos os apps |
| `pnpm typecheck` | Checagem de tipos no monorepo |
| `pnpm test` | Testes de integração da API (usa o banco `tributoleao_test`, criado automaticamente) |
| `pnpm db:studio` | Abre o Prisma Studio |
