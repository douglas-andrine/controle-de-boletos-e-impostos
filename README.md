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

## Rodando localmente

Pré-requisitos: Node 20.19+, pnpm 10 e Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
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
| `pnpm db:studio` | Abre o Prisma Studio |
