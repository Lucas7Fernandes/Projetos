# Deploy do Worker do Portal

## Objetivo
Servir o portal HTML no endereço `https://projetos.7lucasfernandes.workers.dev/`,
como alternativa ao GitHub Pages.

## Como fazer (~3 minutos)

1. Acessar https://dash.cloudflare.com → Workers & Pages
2. **Create application** → **Create Worker**
3. Nome: `projetos` (esse nome vira o subdomínio `projetos.7lucasfernandes.workers.dev`)
4. **Deploy** (deixa o Hello World padrão por agora)
5. Abrir o worker recém-criado → **Edit code**
6. Selecionar tudo (Ctrl+A) e apagar
7. Colar o conteúdo de `worker.js` desta pasta
8. **Save and Deploy**

## Validar

Abrir no navegador: https://projetos.7lucasfernandes.workers.dev/

Deve carregar o portal exatamente como no GitHub Pages. Se aparecer tela em
branco, é sinal de que o domain lock do JS não reconheceu o hostname — nesse
caso o próximo deploy do `index.html` precisa incluir esse hostname na
whitelist (já está feito no build atual).

## TTL do cache

O HTML fica em cache no edge por 5 minutos. Se você fizer um novo commit no
GitHub, pode levar até 5 min para aparecer no Cloudflare. Para forçar update
imediato: Cloudflare Dashboard → Worker → **Deployments** → **Purge cache**.
