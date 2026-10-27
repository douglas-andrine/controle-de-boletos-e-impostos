# Deploy do TributoLeão

Três serviços gratuitos, nesta ordem: **Supabase** (banco) → **Render** (API) → **Vercel** (front).
Todos permitem login com a conta do GitHub.

```
Navegador ──► Vercel (tributoleao.vercel.app)
                 ├── /*      → arquivos do React
                 └── /api/*  → rewrite → Render (tributoleao-api.onrender.com) ──► Supabase (Postgres)
```

O rewrite `/api` faz o navegador enxergar front e API na **mesma origem**. Por isso o cookie de
sessão HTTP-only funciona sem depender de cookies de terceiros (bloqueados pelo Safari e cada vez mais pelo Chrome).

---

## 1. Supabase (banco de dados)

1. Em [supabase.com](https://supabase.com), crie um projeto:
   - **Region:** `East US (North Virginia)`, a mesma região da API no Render. O dashboard faz várias consultas
     por requisição, e banco e API próximos fazem diferença.
   - **Database password:** gere uma senha forte e guarde-a no seu gerenciador de senhas.
2. No projeto, clique em **Connect** (topo da página) e copie duas URLs, trocando `[YOUR-PASSWORD]` pela senha:

   | Variável | Onde pegar | Ajuste |
   |---|---|---|
   | `DATABASE_URL` | **Transaction pooler** (porta `6543`) | adicione `?pgbouncer=true&connection_limit=5` no final |
   | `DIRECT_URL` | **Session pooler** (porta `5432`) | nenhum |

   > Não use a "Direct connection": ela é só IPv6, e o Render não tem saída IPv6. As migrations falhariam com `P1001`.

Não precisa criar tabelas: a API aplica as migrations sozinha a cada deploy.

## 2. Render (API)

1. Em [render.com](https://render.com): **New → Blueprint** e selecione o repositório
   `controle-de-boletos-e-impostos`. O Render lê o [`render.yaml`](render.yaml).
2. Preencha as variáveis pedidas:
   - `DATABASE_URL` e `DIRECT_URL`: as duas URLs do Supabase.
   - `WEB_ORIGIN`: a URL da Vercel. Se ainda não tiver, use `https://tributoleao.vercel.app` e ajuste depois.
   - `JWT_SECRET` é gerado automaticamente pelo Render.
3. Clique em **Apply**. O primeiro deploy leva alguns minutos.
4. Teste em `https://tributoleao-api.onrender.com/health`. A resposta deve ser `{"status":"ok","database":"ok"}`.

> Se o nome `tributoleao-api` já estiver em uso, o Render cria uma URL com sufixo (ex.: `tributoleao-api-x1y2.onrender.com`).
> Nesse caso, atualize o `destination` em [`apps/web/vercel.json`](apps/web/vercel.json) e faça push.

## 3. Vercel (front)

1. Em [vercel.com](https://vercel.com): **Add New → Project** e importe o repositório.
2. Em **Root Directory**, escolha `apps/web`. O framework (Vite) e o pnpm são detectados sozinhos.
3. **Deploy**.
4. Se a URL final não for `https://tributoleao.vercel.app`, atualize `WEB_ORIGIN` no Render
   (Environment → editar → Save, e ele faz o redeploy).

## 4. Conferência

1. Abra a URL da Vercel e clique em **Entrar como demonstração**.
2. O primeiro acesso depois de um tempo parado pode levar até 1 minuto: o plano gratuito do Render hiberna a API.
   A tela de login avisa "Acordando o servidor…".
3. Cadastre uma conta própria para confirmar o fluxo de cadastro.

---

## Deploys seguintes

Basta dar push na `main`:

- O **GitHub Actions** ([`ci.yml`](.github/workflows/ci.yml)) roda typecheck, testes e build.
- O **Render** faz redeploy quando muda algo em `apps/api`, `packages/shared` ou no lockfile.
- A **Vercel** faz redeploy do front.

## Limites do plano gratuito

| Serviço | Limite | Efeito |
|---|---|---|
| Render | hiberna após 15 min sem acesso | primeiro acesso leva de 30 a 60 s |
| Supabase | pausa o projeto após 7 dias sem atividade | reative pelo painel (botão *Restore*) |
| Vercel | 100 GB de banda/mês | sobra para um portfólio |

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Build do Render falha em `corepack enable` | troque o início do build command por `npm install -g pnpm@10.34.4 &&` |
| `P1001: Can't reach database server` | `DIRECT_URL` usando a conexão direta (IPv6): use o Session pooler |
| `prepared statement "s0" already exists` | faltou `?pgbouncer=true` na `DATABASE_URL` |
| Login funciona, mas recarregar a página desloga | o front está chamando a API direto, não pelo `/api`: confira o `vercel.json` |
| `/api/...` retorna 404 na Vercel | Root Directory não está em `apps/web`, ou a URL do Render no `vercel.json` está errada |
