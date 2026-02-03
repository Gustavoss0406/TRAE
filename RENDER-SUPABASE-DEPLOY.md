# Guia de Deploy: Render.com + Supabase PostgreSQL

**Plataforma**: 100% Gratuita  
**Stack**: Node.js + PostgreSQL + tRPC  
**Tempo estimado**: 15-20 minutos

---

## 📋 Pré-requisitos

1. Conta no [GitHub](https://github.com) (gratuita)
2. Conta no [Supabase](https://supabase.com) (gratuita)
3. Conta no [Render.com](https://render.com) (gratuita)

---

## 🗄️ Passo 1: Configurar Banco de Dados no Supabase

### 1.1. Criar Projeto no Supabase

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `football-data-platform`
   - **Database Password**: Crie uma senha forte (anote!)
   - **Region**: `East US (North Virginia)` (mais próximo do Render Oregon)
4. Clique em **"Create new project"**
5. Aguarde 2-3 minutos até o projeto estar pronto

### 1.2. Obter Connection String

1. No dashboard do projeto, clique em **"Settings"** (ícone de engrenagem)
2. Clique em **"Database"** no menu lateral
3. Role até **"Connection string"**
4. Selecione **"URI"** e copie a string que começa com `postgresql://`
5. **Importante**: Substitua `[YOUR-PASSWORD]` pela senha que você criou

Exemplo:
```
postgresql://postgres.tqpuqzvkpvhbdfguvayv:SUA_SENHA_AQUI@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

6. **Guarde essa string** - você vai precisar dela no Render!

---

## 📦 Passo 2: Preparar Código para Deploy

### 2.1. Baixar o Projeto

1. Baixe o checkpoint mais recente do Manus
2. Extraia os arquivos para uma pasta local

### 2.2. Criar Repositório no GitHub

1. Acesse [https://github.com/new](https://github.com/new)
2. Preencha:
   - **Repository name**: `football-data-platform`
   - **Visibility**: Private (recomendado) ou Public
3. **NÃO** marque "Add a README file"
4. Clique em **"Create repository"**

### 2.3. Fazer Upload do Código

**Opção A: Via GitHub Web (mais fácil)**

1. Na página do repositório criado, clique em **"uploading an existing file"**
2. Arraste TODOS os arquivos do projeto para a área de upload
3. Escreva uma mensagem: `Initial commit`
4. Clique em **"Commit changes"**

**Opção B: Via Git CLI (se você tem Git instalado)**

```bash
cd /caminho/para/football-data-platform
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/football-data-platform.git
git push -u origin main
```

---

## 🚀 Passo 3: Deploy no Render.com

### 3.1. Conectar GitHub ao Render

1. Acesse [https://dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Web Service"**
3. Clique em **"Connect account"** para conectar seu GitHub
4. Autorize o Render a acessar seus repositórios
5. Selecione o repositório **`football-data-platform`**

### 3.2. Configurar Web Service

Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Name** | `football-data-api` |
| **Region** | `Oregon (US West)` |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `pnpm install && cp drizzle/schema.postgres.ts drizzle/schema.ts && pnpm db:push` |
| **Start Command** | `NODE_ENV=production node server/_core/index.js` |
| **Instance Type** | `Free` |

### 3.3. Adicionar Variáveis de Ambiente

Role até **"Environment Variables"** e adicione:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Cole a connection string do Supabase (passo 1.2) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `JWT_SECRET` | Gere uma string aleatória (ex: `openssl rand -base64 32`) |
| `VITE_APP_ID` | `football-data-platform` |
| `VITE_APP_TITLE` | `Football Data Platform` |

**Como gerar JWT_SECRET no Windows**:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Como gerar JWT_SECRET no Mac/Linux**:
```bash
openssl rand -base64 32
```

### 3.4. Criar o Serviço

1. Clique em **"Create Web Service"**
2. Aguarde 5-10 minutos enquanto o Render:
   - Instala as dependências
   - Converte o schema para PostgreSQL
   - Aplica as migrações no Supabase
   - Inicia o servidor

### 3.5. Verificar Deploy

1. Quando o status mudar para **"Live"**, clique na URL gerada (ex: `https://football-data-api.onrender.com`)
2. Adicione `/api/trpc/football.leagues` ao final da URL
3. Você deve ver uma resposta JSON com as ligas disponíveis!

---

## ⏰ Passo 4: Configurar Ingestão Automática (Cron Job)

### 4.1. Criar Cron Job

1. No dashboard do Render, clique em **"New +"** → **"Cron Job"**
2. Selecione o mesmo repositório: **`football-data-platform`**

### 4.2. Configurar Cron Job

| Campo | Valor |
|-------|-------|
| **Name** | `football-data-ingestion` |
| **Region** | `Oregon (US West)` |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `pnpm install && cp drizzle/schema.postgres.ts drizzle/schema.ts` |
| **Command** | `node scripts/ingest-from-worker.mjs` |
| **Schedule** | `0 */6 * * *` (a cada 6 horas) |
| **Instance Type** | `Free` |

### 4.3. Adicionar Variáveis de Ambiente

Adicione as mesmas variáveis do Web Service:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Cole a connection string do Supabase |
| `NODE_ENV` | `production` |

### 4.4. Criar e Testar

1. Clique em **"Create Cron Job"**
2. Clique em **"Trigger Run"** para executar manualmente a primeira vez
3. Aguarde 2-3 minutos e verifique os logs
4. Se bem-sucedido, você verá mensagens como "✓ 50 fixtures ingeridos"

---

## ✅ Passo 5: Validar Instalação

### 5.1. Testar Endpoints

Substitua `SEU_APP.onrender.com` pela URL do seu serviço:

**1. Status da API**
```
https://SEU_APP.onrender.com/api/trpc/auth.me
```
Deve retornar: `{"result":{"data":{"json":null}}}`

**2. Ligas Disponíveis**
```
https://SEU_APP.onrender.com/api/trpc/football.leagues?input={"json":{}}
```
Deve retornar: Lista de 17 ligas

**3. Fixtures de Hoje**
```
https://SEU_APP.onrender.com/api/trpc/football.fixtures?input={"json":{"date":"2026-02-02"}}
```
Deve retornar: Lista de partidas

### 5.2. Verificar Banco de Dados

1. Acesse o dashboard do Supabase
2. Clique em **"Table Editor"** no menu lateral
3. Você deve ver tabelas criadas: `fixtures`, `teams`, `leagues`, etc.
4. Clique em `fixtures` para ver os dados ingeridos

---

## 🎯 Próximos Passos

### Adicionar Mais Ligas

Edite `scripts/ingest-from-worker.mjs` e adicione IDs de ligas no array:

```javascript
const LEAGUES = [
  2021, // Premier League
  2014, // La Liga
  2002, // Bundesliga
  2019, // Serie A
  2015, // Ligue 1
  // Adicione mais aqui:
  2003, // Eredivisie
  2017, // Primeira Liga
  // ...
];
```

Commit e push para o GitHub - o Render vai fazer redeploy automaticamente!

### Monitorar Performance

1. No Render dashboard, clique no seu serviço
2. Vá em **"Metrics"** para ver:
   - CPU usage
   - Memory usage
   - Request latency
   - Error rate

### Logs e Debugging

1. No Render dashboard, clique no seu serviço
2. Vá em **"Logs"** para ver logs em tempo real
3. Use filtros para encontrar erros específicos

---

## 🐛 Troubleshooting

### Erro: "Connection timeout" no Supabase

**Solução**: Verifique se a connection string está correta e inclui `?sslmode=require` no final.

### Erro: "Module not found"

**Solução**: Certifique-se que o Build Command inclui `pnpm install`.

### Erro: "Port already in use"

**Solução**: O Render usa a variável `PORT` automaticamente. Não hardcode a porta no código.

### Deploy muito lento

**Solução**: O plano gratuito do Render "hiberna" após 15 minutos de inatividade. A primeira requisição após hibernação pode levar 30-60 segundos.

### Cron Job não executa

**Solução**: Verifique se o schedule está correto (`0 */6 * * *`). O Render usa timezone UTC.

---

## 💰 Limites do Plano Gratuito

### Render.com (Free Tier)

- ✅ 750 horas/mês de runtime (suficiente para 1 serviço 24/7)
- ✅ 100GB bandwidth/mês
- ⚠️ Serviço hiberna após 15 min de inatividade
- ⚠️ Deploy pode levar 5-10 minutos

### Supabase (Free Tier)

- ✅ 500MB de armazenamento no banco
- ✅ 2GB de transferência de dados/mês
- ✅ 50,000 requisições/mês ao banco
- ⚠️ Projeto pausa após 7 dias de inatividade (reativa automaticamente)

**Dica**: Para evitar hibernação do Render, use um serviço de "uptime monitoring" gratuito como [UptimeRobot](https://uptimerobot.com) para fazer ping na API a cada 5 minutos.

---

## 🎉 Conclusão

Parabéns! Sua Football Data Platform está rodando em produção 24/7 gratuitamente!

**URL da sua API**: `https://SEU_APP.onrender.com/api/trpc/`

**Próximos passos sugeridos**:
1. Configure um domínio customizado no Render (ex: `api.seusite.com`)
2. Adicione mais ligas conforme demanda
3. Implemente cache Redis para melhorar performance
4. Configure alertas de monitoramento

**Precisa de ajuda?** Abra uma issue no GitHub ou consulte a documentação:
- [Render Docs](https://render.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

---

**Criado por**: Manus AI  
**Última atualização**: 02/02/2026  
**Versão**: 1.0.0
