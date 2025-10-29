# 🚀 DEPLOY - Dashboard BM

## ✅ SISTEMA COMPLETO PRONTO!

### 🌐 Deploy seguro com Netlify (recomendado para sincronização)

Esta versão usa Netlify Functions como proxy seguro para o GitHub Gist. Isso evita expor o token no cliente.

Funções adicionadas (em `netlify/functions`):
- `gist-read` — lê o conteúdo do Gist e retorna `data.json` (GET)
- `gist-write` — atualiza `data.json` no Gist (POST)

Como configurar no Netlify:
1. Conecte o repositório no Netlify (Sites → New site from Git → GitHub).
2. Em Site settings → Build & Deploy → Environment, adicione as variáveis:
   - `NETLIFY_GIST_TOKEN` = (seu Personal Access Token com permissão para Gists)
   - `GIST_ID` = `004c3f9e832b7a8ad79fdb6a7e1796d5` (ou seu próprio Gist ID)
3. Configure o build command: `npm run build` e publish dir: `dist/dashboard-bm/browser` (ou deixe o Netlify detectar a build).
4. Após deploy, os endpoints disponíveis serão:
   - `/.netlify/functions/gist-read` — leitura do arquivo `data.json`
   - `/.netlify/functions/gist-write` — atualização do `data.json` (envie JSON: `{ "content": "..." }`)

Observação: manter o token somente em variáveis de ambiente do Netlify garante que o token não apareça no bundle cliente.

### Deploy automático no Netlify via GitHub Actions

Se quiser deploy automático toda vez que fizer push na `main`, eu adicionei um workflow GitHub Actions (`.github/workflows/netlify-deploy.yml`) que:
- instala dependências
- gera o build de produção
- usa o Netlify CLI para publicar o diretório `dist/dashboard-bm/browser` no site

Para habilitar o deploy automático configure dois secrets no GitHub (Settings → Secrets and variables → Actions):
- `NETLIFY_AUTH_TOKEN` — seu token de deploy Netlify (obtenha em https://app.netlify.com/user/applications)
- `NETLIFY_SITE_ID` — o ID do site no Netlify (disponível em Site settings → Site information)

Após adicionar esses secrets, o workflow fará deploy automático após cada push para `main`.

---

Se preferir GitHub Pages, há um workflow que publica o `dist/dashboard-bm/browser` no Pages, mas para sincronização segura recomendamos Netlify com funções serverless.
