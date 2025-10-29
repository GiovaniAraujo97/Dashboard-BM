# 🔥 TESTE PRÁTICO - Sistema de Dados Compartilhados

## 🎯 Como testar o compartilhamento em tempo real:

### Passo 1: Configure o GitHub Token
1. Acesse: https://github.com/settings/tokens
2. Crie um token com permissão `gist`
3. Acesse: https://gist.github.com/
4. Crie um gist público com o nome `data.json` e conteúdo:
```json
{
  "emprestimos": [],
  "clientes": [],
  "lastUpdated": "2024-10-28T00:00:00.000Z",
  "version": 1
}
```

### Passo 2: Configure o sistema
Edite `src/app/services/storage.service.ts`:
- Linha 13: Configure o token via variável de ambiente (não commitá-lo). Ex.: `VITE_GITHUB_TOKEN=seu_token_aqui`
- Linha 14: Substitua `'your-gist-id-here'` pelo ID do seu gist

### Passo 3: Teste o compartilhamento

**🧪 EXPERIMENTO PRÁTICO:**

1. **Abra em 2 navegadores diferentes** (Chrome e Firefox)
   - Acesse: `http://localhost:63107/login`
   - Senha: `1234`

2. **No Chrome:**
   - Vá para "Clientes"
   - Adicione um cliente: "João da Silva"
   
3. **No Firefox:**
   - Espere 30 segundos (sincronização automática)
   - Verifique se o cliente "João da Silva" apareceu!

4. **No Firefox:**
   - Adicione um empréstimo para João da Silva
   
5. **No Chrome:**
   - Espere 30 segundos
   - Verifique se o empréstimo apareceu!

### Passo 4: Teste em dispositivos diferentes

**📱 TESTE MOBILE:**
1. **No seu celular:**
   - Acesse o mesmo link: `http://[SEU-IP]:63107/login`
   - Cadastre um cliente "Maria Santos"

2. **No seu computador:**
   - Aguarde a sincronização
   - Veja o cliente "Maria Santos" aparecer automaticamente!

## 🌍 **DEPLOY PARA PRODUÇÃO:**

### 1. GitHub + Netlify

```bash
# 1. Commit e push
git add .
git commit -m "Sistema de empréstimos com sincronização global"
git push origin main

# 2. Build de produção
npm run build
```

### 2. Deploy no Netlify
- Conecte o repositório
- Build command: `npm run build`
- Publish directory: `dist/dashboard-bm`
- Netlify gerará um link público: `https://bm-emprestimos-abc123.netlify.app`

### 3. Compartilhe o link!
- **Qualquer pessoa** que acessar o link verá os **MESMOS DADOS**
- **Mudanças em tempo real** entre todos os usuários
- **Funciona em qualquer dispositivo**: celular, tablet, computador

## 🎯 **RESULTADO FINAL:**

✅ **João acessa no celular** → Adiciona cliente "Pedro"
✅ **Maria acessa no computador** → VÊ o cliente "Pedro" automaticamente
✅ **Carlos acessa no tablet** → Adiciona empréstimo para Pedro
✅ **TODOS** veem o empréstimo em tempo real!

## 🔧 **Status Atual:**
- ✅ Sistema funcionando: `http://localhost:63107/`
- ⏳ Aguardando: Configuração do GitHub Token
- 🚀 Pronto para: Deploy e compartilhamento global

**Agora você tem um sistema de empréstimos VERDADEIRAMENTE compartilhado!** 🎉