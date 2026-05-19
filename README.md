# TaskHub

TaskHub e um app de tarefas colaborativas feito com Expo, React Native e uma API Express. O backend pode rodar com Supabase ou MongoDB, mas o ambiente atual esta configurado para Supabase.

## Funcionalidades

- Cadastro e login com JWT.
- Avatar de usuario com upload opcional para Cloudinary.
- Criacao, edicao, conclusao e exclusao de tarefas.
- Tarefas para voce e tarefas que voce designou para outras pessoas.
- Busca, filtros por status e ordenacao por prioridade/data.
- Notificacoes push e lembretes locais.
- Atualizacao em tempo real com Socket.IO.
- Historico de atividades por tarefa.
- Tema claro/escuro persistente.
- Data de finalizacao exibida em tarefas concluidas.

## Stack

- Expo + React Native
- TypeScript
- NativeWind/Tailwind
- Express
- Supabase ou MongoDB Atlas
- Socket.IO
- JWT
- Cloudinary opcional

## Como rodar localmente

Instale as dependencias:

```bash
npm install
npm --prefix server install
```

Configure o backend:

```bash
cp server/.env.example server/.env
```

Para Supabase, preencha no `server/.env`:

```env
DB_PROVIDER=supabase
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
JWT_SECRET=Gere sua Chave
PORT=4000
```

Crie/atualize as tabelas no Supabase usando:

- [server/supabase/schema.sql](server/supabase/schema.sql)
- [server/supabase/add_completed_at.sql](server/supabase/add_completed_at.sql), se o banco ja existia antes da coluna `completed_at`

Rode a API:

```bash
npm run server
```

Configure a URL da API no `.env` da raiz:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_DA_REDE:4000
```

Rode o app:

```bash
npm start
```

## Deploy

### API no Render

O arquivo `render.yaml` configura o servico `taskhub-api`.

No Render:

1. Crie ou atualize o Blueprint usando este repositorio.
2. Confirme o servico `taskhub-api`.
3. Garanta que `DB_PROVIDER` esteja como `supabase`.
4. Preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
5. Defina `JWT_SECRET` ou deixe o Render gerar uma chave.
6. Opcionalmente preencha `CLOUDINARY_URL`.

Depois de cada push com alteracoes no backend, faca redeploy da API no Render caso o deploy automatico nao esteja ativo.

### Frontend/mobile

O app usa `EXPO_PUBLIC_API_URL` para decidir qual API chamar. O `eas.json` aponta para:

```env
EXPO_PUBLIC_API_URL=https://taskhub-api-zhz5.onrender.com
```

Para atualizar o app instalado no celular, gere uma nova build EAS:

```bash
npx eas-cli@latest build -p android --profile preview
```

O ajuste de teclado no Android depende de configuracao nativa em `app.json`, entao nao entra apenas por update OTA.

Se voce tiver um Static Site separado no Render para o frontend web, faca redeploy desse servico depois do push para o GitHub.

## Notas recentes

A documentacao curta do que foi alterado esta em [docs/2026-05-taskhub-supabase-and-tasks.md](docs/2026-05-taskhub-supabase-and-tasks.md).

## Seguranca

Arquivos `.env` reais nao devem ir para o GitHub. Use apenas `.env.example` como modelo.

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no app mobile/web. Ela deve existir somente no backend.
