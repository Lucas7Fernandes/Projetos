# Deploy do Cache Compartilhado

## Contexto
O portal está pronto para operar com **cache compartilhado no edge do Cloudflare**, sem KV, sem bindings, sem configuração extra. Só precisa colar o código do Worker novo por cima do antigo.

O código do cliente (`index.html`) já detecta automaticamente se o Worker responde às novas rotas — enquanto o deploy não é feito, tudo funciona no modo legado (cache local por navegador). Assim que o Worker for atualizado, o cache compartilhado passa a valer para todos.

## Deploy (2 passos, ~2 minutos)

### 1. Substituir o código do Worker
1. Acessar https://dash.cloudflare.com → Workers & Pages
2. Abrir o Worker `goobee-proxy`
3. Aba **Edit Code** (ou "Quick Edit")
4. Selecionar **todo** o código atual (`Ctrl+A` / `Cmd+A`) e apagar
5. Colar o conteúdo do arquivo `worker.js` desta pasta
6. **Save and Deploy**

### 2. Popular o cache inicial
No terminal ou no navegador:
```
curl -X POST https://goobee-proxi.7lucasfernandes.workers.dev/refresh
```
(ou apenas: primeira pessoa que abrir o portal e clicar em "Atualizar" popula tudo).

## Como funciona (resumo)

- **`caches.default`** é o cache de edge do Cloudflare, compartilhado entre todos os visitantes que caem no mesmo data center. Como praticamente todo mundo do Brasil cai no edge de São Paulo, o cache é efetivamente único para toda a P&P.
- **TTL de 6 horas** — se ninguém apertar "Atualizar" nesse período, a próxima leitura retorna 404 e o cliente automaticamente força um refresh (não precisa intervenção humana).
- **Rotas expostas:**
  - `GET /cache` → dados atuais + timestamp (rápido, ~30ms)
  - `POST /refresh` → força busca na Goobee, atualiza cache para todos (~2s)
  - `GET /status` → só timestamp (polling silencioso de 30s no cliente, payload ~30 bytes)
  - `GET /?url=...` → passthrough legado mantido para retrocompatibilidade

## Comportamento esperado após deploy

- ✅ Ao abrir o portal → carrega do cache do edge (rápido)
- ✅ Ao clicar em "Atualizar" → busca da Goobee, salva no edge, todos veem
- ✅ Timestamp "há X min" sincronizado entre usuários (via polling de 30s)
- ✅ Quando outra pessoa atualiza → toast opt-in "Dados atualizados por outro usuário. Atualize quando quiser."
- ✅ **Sem refresh automático forçado** — nunca interrompe quem está trabalhando
- ✅ F5 na página → carrega do cache do edge (não dispara nova chamada Goobee)

## Bônus de segurança
O token da API Goobee sai do HTML público e passa a viver **só dentro do Worker**. Recomendação: rotacionar o token na Goobee depois do deploy, para invalidar a versão que ficou exposta no histórico do repositório.

## Rollback
Se algo der errado: no Cloudflare, aba "Deployments" do Worker → escolher a versão anterior → "Rollback to this version". Volta ao Worker antigo (passthrough puro) e o cliente detecta e opera em modo legado automaticamente.

## Limitações honestas

- **Inconsistência entre regiões**: usuários em cidades diferentes podem cair em data centers diferentes e ver timestamps ligeiramente distintos por alguns minutos. Na prática, com usuários todos no Brasil, isso não é problema real.
- **TTL fixo de 6h**: se ninguém abrir o portal por 6h, a primeira pessoa a abrir vai pagar o tempo de ~2s do refresh automático. Ajustável no código (constante `CACHE_TTL_SECONDS`).
