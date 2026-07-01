# Deploy do Cache Compartilhado (Item 4 do prompt)

## Contexto
O cliente atual foi ampliado para funcionar em **dois modos**:
- **Modo legado**: se o Worker responder no formato antigo (passthrough `?url=...`), tudo funciona como hoje.
- **Modo cache compartilhado**: se o Worker responder às novas rotas (`/cache`, `/refresh`, `/status`), o cliente passa automaticamente a usá-las.

Isso significa que você pode fazer o deploy do Worker novo **sem precisar mexer no cliente** — a transição é gradual e não quebra ninguém.

## Passos no Cloudflare Dashboard

### 1. Criar o KV namespace
1. Cloudflare Dashboard → Workers & Pages → KV
2. Create namespace, nomear: `GOOBEE_CACHE`
3. Copiar o ID do namespace

### 2. Atualizar o Worker
1. Ir para o Worker `goobee-proxy`
2. Aba "Settings" → "Variables and Secrets" → "KV Namespace Bindings"
3. Adicionar binding:
   - Variable name: `GOOBEE_KV`
   - KV namespace: `GOOBEE_CACHE` (criado acima)
4. Aba "Code" → substituir todo o conteúdo pelo arquivo `worker.js` desta pasta
5. Salvar & Deploy

### 3. Popular o cache inicial
Após o deploy, faça uma requisição inicial para popular o KV:
```
curl -X POST https://goobee-proxy.7lucasfernandes.workers.dev/refresh
```
Isso vai chamar a Goobee, salvar em cache e retornar os dados. A partir daí:
- Novos usuários chamam `/cache` (~50ms, dado do KV)
- Botão Atualizar chama `/refresh` (chama Goobee de verdade)
- Polling silencioso chama `/status` (só timestamp)

## Custos e limites
- KV grátis: 100k reads/dia + 1000 writes/dia
- Cada page load = 1 read (`/cache`)
- Cada polling de 30s por usuário = 2 reads/min = 2880 reads/dia por usuário ativo o dia inteiro
- Estimativa para 20 usuários ativos: ~60k reads/dia (dentro do grátis)
- Reduzir polling para 60s se ultrapassar

## Segurança colateral (bônus)
Com o cache no Worker, o token da API **para de ser exposto no HTML client-side**.
Recomendação: rotacionar o token na Goobee e trocar somente dentro do Worker.

## Rollback
Se algo der errado, basta reverter o Worker para o código antigo (passthrough puro).
O cliente detecta o formato de resposta e volta ao modo legado automaticamente.
