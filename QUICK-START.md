# 🚀 Quick Start: GitHub → Render Deploy

**Tempo total**: 15 minutos  
**Custo**: R$ 0,00 (100% gratuito)

---

## 📦 Passo 1: Upload para GitHub (5 minutos)

### 1.1. Baixar e Extrair

1. Baixe o arquivo `football-github-deploy.tar.gz` anexado
2. Extraia para uma pasta no seu computador
3. Você verá todos os arquivos do projeto

### 1.2. Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Preencha:
   - **Repository name**: `football-data-platform`
   - **Visibility**: Private (recomendado)
3. **NÃO marque** "Add a README file"
4. Clique em **"Create repository"**

### 1.3. Fazer Upload

**Método 1: Via Interface Web (MAIS FÁCIL)**

1. Na página do repositório, clique em **"uploading an existing file"**
2. Arraste TODOS os arquivos extraídos para a área de upload
3. Aguarde o upload terminar (pode levar 1-2 minutos)
4. Escreva: `Initial commit`
5. Clique em **"Commit changes"**

**Método 2: Via Git CLI (se você tem Git instalado)**

```bash
cd /caminho/para/pasta/extraida
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/football-data-platform.git
git push -u origin main
```

---

## 🗄️ Passo 2: Configurar Supabase (5 minutos)

### 2.1. Criar Projeto

1. Acesse: https://supabase.com/dashboard
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `football-data-platform`
   - **Database Password**: Crie uma senha forte (ANOTE!)
   - **Region**: `East US (North Virginia)`
4. Clique em **"Create new project"**
5. Aguarde 2-3 minutos

### 2.2. Copiar Connection String

1. Clique em **"Settings"** (ícone de engrenagem)
2. Clique em **"Database"** no menu lateral
3. Role até **"Connection string"**
4. Selecione **"URI"**
5. Copie a string (começa com `postgresql://`)
6. **IMPORTANTE**: Substitua `[YOUR-PASSWORD]` pela sua senha

Exemplo:
```
postgresql://postgres.abc123:SUA_SENHA@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**GUARDE ESSA STRING!** Você vai precisar no próximo passo.

---

## 🚀 Passo 3: Deploy no Render (5 minutos)

### 3.1. Criar Web Service

1. Acesse: https://dashboard.render.com
2. Clique em **"New +"** → **"Web Service"**
3. Conecte sua conta do GitHub (se for a primeira vez)
4. Selecione o repositório: **`football-data-platform`**

### 3.2. Configurar

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

Role até **"Environment Variables"** e clique em **"Add Environment Variable"**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Cole a connection string do Supabase (passo 2.2) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `JWT_SECRET` | `sua-string-aleatoria-aqui-min-32-chars` |
| `VITE_APP_ID` | `football-data-platform` |
| `VITE_APP_TITLE` | `Football Data Platform` |

**Como gerar JWT_SECRET**:
- Windows: Abra PowerShell e execute:
  ```powershell
  -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
  ```
- Mac/Linux: Abra Terminal e execute:
  ```bash
  openssl rand -base64 32
  ```

### 3.4. Criar e Aguardar

1. Clique em **"Create Web Service"**
2. Aguarde 5-10 minutos (o Render vai instalar dependências e fazer deploy)
3. Quando aparecer **"Live"** com bolinha verde, está pronto!

---

## ✅ Passo 4: Testar (1 minuto)

### 4.1. Copiar URL

Na página do seu serviço no Render, copie a URL (ex: `https://football-data-api.onrender.com`)

### 4.2. Testar Endpoints

Cole no navegador (substitua `SEU_APP` pela sua URL):

**1. Ligas Disponíveis**
```
https://SEU_APP.onrender.com/api/trpc/football.leagues?input={"json":{}}
```
✅ Deve retornar JSON com 17 ligas

**2. Fixtures de Hoje**
```
https://SEU_APP.onrender.com/api/trpc/football.fixtures?input={"json":{"date":"2026-02-02"}}
```
✅ Deve retornar JSON com partidas

**3. Times**
```
https://SEU_APP.onrender.com/api/trpc/football.teams?input={"json":{}}
```
✅ Deve retornar JSON com 2000+ times

---

## 🎉 Pronto!

Sua API está rodando 24/7 gratuitamente!

**URL da API**: `https://SEU_APP.onrender.com/api/trpc/`

### Próximos Passos Opcionais

**1. Configurar Cron Job (Atualização Automática)**

No Render dashboard:
1. Clique em **"New +"** → **"Cron Job"**
2. Selecione o mesmo repositório
3. Configure:
   - **Name**: `football-ingestion`
   - **Command**: `node scripts/ingest-from-worker.mjs`
   - **Schedule**: `0 */6 * * *` (a cada 6 horas)
4. Adicione as mesmas variáveis de ambiente (DATABASE_URL, NODE_ENV)

**2. Evitar Hibernação (Opcional)**

O plano gratuito hiberna após 15 min. Para evitar:
1. Cadastre-se em: https://uptimerobot.com (gratuito)
2. Adicione um monitor HTTP
3. URL: `https://SEU_APP.onrender.com/api/trpc/auth.me`
4. Intervalo: 5 minutos

---

## 🐛 Problemas Comuns

### Deploy falhou com erro "pnpm not found"

**Solução**: O Render detecta automaticamente. Se falhar, adicione no Build Command:
```
npm install -g pnpm && pnpm install && cp drizzle/schema.postgres.ts drizzle/schema.ts && pnpm db:push
```

### Erro "Connection refused" ao acessar API

**Solução**: Aguarde 1-2 minutos após o deploy ficar "Live". O servidor pode estar iniciando.

### Erro "Database connection failed"

**Solução**: Verifique se:
1. A connection string do Supabase está correta
2. Você substituiu `[YOUR-PASSWORD]` pela senha real
3. A string termina com `?sslmode=require`

### API muito lenta na primeira requisição

**Solução**: Normal! O plano gratuito hiberna. A primeira requisição demora 30-60s. Depois fica rápido.

---

## 📞 Precisa de Ajuda?

- **Guia completo**: Veja `RENDER-SUPABASE-DEPLOY.md` no projeto
- **Render Docs**: https://render.com/docs
- **Supabase Docs**: https://supabase.com/docs

---

**Criado por**: Manus AI  
**Data**: 02/02/2026
