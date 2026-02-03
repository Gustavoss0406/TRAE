# Guia de Deploy - Football Data Platform

**Última atualização**: 2 de fevereiro de 2026

Este guia explica passo a passo como fazer o deploy **100% gratuito** da Football Data Platform usando **Render.com** (hospedagem) + **PlanetScale** (banco de dados MySQL gratuito).

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

1. **Conta no GitHub** (gratuita) - [Criar conta](https://github.com/signup)
2. **Conta no Render.com** (gratuita) - [Criar conta](https://render.com/register)
3. **Conta no PlanetScale** (gratuita) - [Criar conta](https://planetscale.com/signup)
4. **Git instalado** no seu computador - [Baixar Git](https://git-scm.com/downloads)

**Não precisa saber programar!** Basta seguir os passos abaixo.

---

## 🚀 Passo 1: Subir o Código para o GitHub

### 1.1. Baixar os Arquivos do Projeto

Se você ainda não tem os arquivos no seu computador:

1. No Manus, clique no botão **"Download"** no card do projeto
2. Extraia o arquivo ZIP para uma pasta (exemplo: `C:\projetos\football-api`)

### 1.2. Criar Repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login
2. Clique no botão **"+"** no canto superior direito
3. Selecione **"New repository"**
4. Preencha:
   - **Repository name**: `football-data-api` (ou qualquer nome)
   - **Description**: "API de dados de futebol compatível com API-Football"
   - **Visibility**: Escolha **Public** (gratuito) ou **Private** (se tiver GitHub Pro)
5. **NÃO** marque "Add a README file"
6. Clique em **"Create repository"**

### 1.3. Fazer Upload dos Arquivos

**Opção A: Pelo Terminal (Recomendado)**

Abra o terminal/prompt de comando na pasta do projeto e execute:

```bash
# Inicializar repositório Git
git init

# Adicionar todos os arquivos
git add .

# Fazer o primeiro commit
git commit -m "Initial commit - Football Data Platform"

# Conectar com o GitHub (substitua SEU-USUARIO e NOME-DO-REPO)
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git

# Enviar para o GitHub
git branch -M main
git push -u origin main
```

**Opção B: Pelo GitHub Desktop (Mais Fácil)**

1. Baixe o [GitHub Desktop](https://desktop.github.com/)
2. Abra o GitHub Desktop e faça login
3. Clique em **"Add"** > **"Add Existing Repository"**
4. Selecione a pasta do projeto
5. Clique em **"Publish repository"**
6. Escolha o nome e clique em **"Publish"**

---

## 🗄️ Passo 2: Criar Banco de Dados no PlanetScale

### 2.1. Criar Database

1. Acesse [planetscale.com](https://planetscale.com) e faça login
2. Clique em **"Create a database"**
3. Preencha:
   - **Name**: `football-data`
   - **Region**: Escolha **US East (Ohio)** (mais próximo do Render)
   - **Plan**: Selecione **Hobby** (gratuito)
4. Clique em **"Create database"**

### 2.2. Obter String de Conexão

1. Na página do database, clique em **"Connect"**
2. Selecione **"Connect with: Prisma"** (funciona com Drizzle também)
3. Copie a **DATABASE_URL** (algo como `mysql://user:password@aws.connect.psdb.cloud/football-data?sslaccept=strict`)
4. **GUARDE ESSA URL!** Você vai precisar dela no Render

### 2.3. Aplicar Schema do Banco

Você precisa criar as tabelas no banco. Existem duas formas:

**Opção A: Pelo Manus (Mais Fácil)**

1. No Manus, abra o terminal do projeto
2. Execute:
   ```bash
   export DATABASE_URL="sua-url-copiada-do-planetscale"
   pnpm db:push
   ```

**Opção B: Pelo PlanetScale Console**

1. No PlanetScale, clique em **"Console"**
2. Cole e execute o SQL do arquivo `drizzle/schema.sql` (se existir)
3. Ou execute manualmente os comandos CREATE TABLE de `drizzle/schema.ts`

---

## 🌐 Passo 3: Deploy no Render.com

### 3.1. Conectar Repositório

1. Acesse [render.com](https://render.com) e faça login
2. No dashboard, clique em **"New +"** > **"Web Service"**
3. Clique em **"Connect a repository"**
4. Se for a primeira vez, clique em **"Configure account"** e autorize o Render a acessar o GitHub
5. Selecione o repositório `football-data-api` (ou o nome que você escolheu)
6. Clique em **"Connect"**

### 3.2. Configurar o Serviço

Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Name** | `football-data-api` (ou qualquer nome único) |
| **Region** | **Ohio (US East)** (mesmo do PlanetScale) |
| **Branch** | `main` |
| **Root Directory** | (deixe vazio) |
| **Runtime** | **Node** |
| **Build Command** | `pnpm install && pnpm run build` |
| **Start Command** | `pnpm start` |
| **Plan** | **Free** |

### 3.3. Configurar Variáveis de Ambiente

Role a página até **"Environment Variables"** e adicione:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Cole a URL do PlanetScale que você copiou |
| `PORT` | `10000` |

**IMPORTANTE**: Clique em **"Add Environment Variable"** para cada uma.

### 3.4. Fazer o Deploy

1. Role até o final da página
2. Clique em **"Create Web Service"**
3. Aguarde o build (pode levar 5-10 minutos na primeira vez)
4. Quando aparecer **"Live"** em verde, seu deploy está pronto! 🎉

### 3.5. Testar a API

Sua API estará disponível em:

```
https://football-data-api.onrender.com
```

Teste acessando:

```
https://football-data-api.onrender.com/api/trpc/football.fixtures?input=%7B%22json%22%3A%7B%7D%7D
```

Se retornar JSON com fixtures, está funcionando!

---

## 🔄 Passo 4: Configurar Ingestão Automática (Opcional)

Para manter os dados sempre atualizados, você precisa rodar o script de ingestão periodicamente.

### 4.1. Criar Cron Job no Render

1. No dashboard do Render, clique em **"New +"** > **"Cron Job"**
2. Conecte o mesmo repositório
3. Preencha:
   - **Name**: `football-data-ingestion`
   - **Command**: `node scripts/ingest-from-worker.mjs`
   - **Schedule**: `0 */6 * * *` (a cada 6 horas)
4. Adicione as mesmas variáveis de ambiente do Web Service
5. Clique em **"Create Cron Job"**

**Atenção**: Cron Jobs gratuitos no Render têm limite de 400 horas/mês. Se ultrapassar, a ingestão para até o mês seguinte.

---

## 📊 Passo 5: Monitorar a API

### 5.1. Ver Logs no Render

1. No dashboard do Render, clique no seu serviço `football-data-api`
2. Clique na aba **"Logs"**
3. Você verá todos os logs em tempo real

### 5.2. Executar Script de Monitoramento

Para ver métricas detalhadas:

1. No Render, clique na aba **"Shell"**
2. Execute:
   ```bash
   pnpm exec tsx scripts/monitor-system.mjs
   ```

Você verá:
- Total de fixtures, leagues, teams
- Latência da API
- Taxa de erro
- Alertas (se houver problemas)

---

## 🔧 Problemas Comuns e Soluções

### ❌ Build falhou com "pnpm not found"

**Solução**: O Render usa npm por padrão. Altere o **Build Command** para:

```bash
npm install -g pnpm && pnpm install && pnpm run build
```

### ❌ API retorna erro 500

**Causa**: Banco de dados não conectado ou schema não aplicado.

**Solução**:
1. Verifique se a `DATABASE_URL` está correta nas variáveis de ambiente
2. Execute `pnpm db:push` localmente com a URL do PlanetScale
3. Reinicie o serviço no Render

### ❌ API muito lenta (> 2 segundos)

**Causa**: Plano gratuito do Render "hiberna" após 15 minutos de inatividade.

**Solução**:
- **Opção 1**: Aceite a latência (primeira requisição demora ~30s para "acordar")
- **Opção 2**: Use um serviço de "ping" gratuito como [UptimeRobot](https://uptimerobot.com) para fazer requisições a cada 10 minutos
- **Opção 3**: Upgrade para plano pago do Render ($7/mês) que não hiberna

### ❌ Banco de dados cheio

**Causa**: Plano gratuito do PlanetScale tem limite de 5GB.

**Solução**:
1. Delete fixtures antigas:
   ```sql
   DELETE FROM fixtures WHERE date < DATE_SUB(NOW(), INTERVAL 60 DAY);
   ```
2. Ou faça upgrade para plano pago ($29/mês)

---

## 🎯 Próximos Passos

Agora que sua API está no ar, você pode:

1. **Adicionar mais ligas**: Edite `scripts/ingest-from-worker.mjs` e adicione mais IDs de ligas
2. **Criar documentação pública**: Use [Swagger UI](https://swagger.io/tools/swagger-ui/) para documentar os endpoints
3. **Adicionar domínio customizado**: No Render, vá em **Settings** > **Custom Domain** (gratuito)
4. **Monitorar uptime**: Configure alertas no [UptimeRobot](https://uptimerobot.com)

---

## 📞 Suporte

Se tiver problemas:

1. **Logs do Render**: Sempre verifique os logs primeiro
2. **Documentação do Render**: [render.com/docs](https://render.com/docs)
3. **Documentação do PlanetScale**: [planetscale.com/docs](https://planetscale.com/docs)
4. **GitHub Issues**: Abra uma issue no repositório

---

## 💰 Custos Estimados

| Serviço | Plano Gratuito | Limites | Upgrade |
|---------|----------------|---------|---------|
| **Render** | Free | 750 horas/mês, hiberna após 15min | $7/mês (sem hibernação) |
| **PlanetScale** | Hobby | 5GB storage, 1 bilhão reads/mês | $29/mês (10GB) |
| **GitHub** | Free | Repositórios públicos ilimitados | $4/mês (privados) |

**Total**: **R$ 0/mês** com limitações, ou **~R$ 180/mês** para produção sem limites.

---

## ✅ Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Repositório no GitHub criado e atualizado
- [ ] Banco de dados no PlanetScale criado
- [ ] Schema aplicado no banco (tabelas criadas)
- [ ] Web Service no Render configurado e rodando
- [ ] Variáveis de ambiente configuradas corretamente
- [ ] API testada e retornando dados
- [ ] Cron Job de ingestão configurado (opcional)
- [ ] Monitoramento funcionando

**Parabéns! Sua API está no ar! 🚀**
