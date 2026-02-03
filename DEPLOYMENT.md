# Guia de Deploy Gratuito (Render)

Este projeto pode ser hospedado gratuitamente no [Render](https://render.com).

## Pré-requisitos
1. Uma conta no GitHub/GitLab.
2. O código deste projeto enviado para um repositório (público ou privado).
3. Uma conta no Render.

## Passo a Passo

### 1. Banco de Dados (PostgreSQL)
O Render oferece um PostgreSQL gratuito (90 dias de retenção, mas renovável ou suficiente para testes).

1. No Dashboard do Render, clique em **New +** -> **PostgreSQL**.
2. **Name**: `football-db` (ou o que preferir).
3. **Database**: `football_db`.
4. **User**: `user`.
5. **Region**: Escolha a mais próxima (ex: Ohio ou Frankfurt).
6. **Plan**: Free.
7. Clique em **Create Database**.
8. Copie a **Internal Database URL** (se for deployar o app no Render) ou **External Database URL** (se for conectar localmente).

### 2. Web Service (Node.js Backend)
1. No Dashboard, clique em **New +** -> **Web Service**.
2. Conecte seu repositório do GitHub.
3. **Name**: `football-api`.
4. **Region**: A mesma do banco de dados.
5. **Branch**: `main` (ou a branch que você está usando).
6. **Runtime**: Node.js.
7. **Build Command**: `npm install && npm run build`.
8. **Start Command**: `npm start`.
9. **Plan**: Free.
10. **Environment Variables** (Adicione estas variáveis):
    - `DATABASE_URL`: Cole a **Internal Database URL** do passo anterior.
    - `NODE_ENV`: `production`
    - `PORT`: `10000` (O Render define automaticamente, mas bom garantir)
    - `JWT_SECRET`: Gere uma string aleatória segura.
    - `VITE_API_URL`: A URL que o Render gerar para você (ex: `https://football-api.onrender.com/api`).
    - `VITE_OAUTH_PORTAL_URL`: URL do portal OAuth (opcional se não usar auth).

### 3. Deploy
1. Clique em **Create Web Service**.
2. Aguarde o build e deploy.
3. Acesse a URL gerada (ex: `https://football-api.onrender.com`).

## Testando
- **API**: `https://seu-app.onrender.com/api/trpc/status`
- **Swagger UI**: `https://seu-app.onrender.com/docs`

## Notas Importantes sobre o Plano Gratuito
- **Inatividade**: O serviço "dorme" após 15 minutos sem tráfego. O primeiro request depois disso pode levar 30-50 segundos.
- **Limites**: 512MB RAM. Cuidado com scrapers pesados.
- **Banco de Dados**: O plano gratuito expira após 90 dias, mas você pode fazer backup e restaurar em uma nova instância gratuita.

## Alternativa: Vercel
O Vercel é excelente para frontend, mas para este projeto (que tem workers em background e websocket/cron), o Render é mais adequado. Se quiser usar Vercel apenas para o frontend, configure a variável `VITE_API_URL` no Vercel apontando para o backend no Render.
