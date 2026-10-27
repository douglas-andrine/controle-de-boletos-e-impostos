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
