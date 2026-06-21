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
BCRYPT_ROUNDS=12
PORT=4000
```

Crie/atualize as tabelas no Supabase usando:

- [server/supabase/schema.sql](server/supabase/schema.sql)
- [server/supabase/add_completed_at.sql](server/supabase/add_completed_at.sql), se o banco ja existia antes da coluna `completed_at`
- [server/supabase/add_security_password_reset.sql](server/supabase/add_security_password_reset.sql), se o banco ja existia antes do reset por codigo

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

## Notificacoes

Com o app aberto, novas tarefas recebidas por Socket.IO disparam uma notificacao local.

Com o app em background ou fechado, a API envia push remoto pelo Expo Push Service. No Android buildado por EAS, esse caminho depende de credenciais FCM configuradas no projeto EAS.

## Notas recentes

A documentacao curta do que foi alterado esta em [docs/2026-05-taskhub-supabase-and-tasks.md](docs/2026-05-taskhub-supabase-and-tasks.md).

## Seguranca

Arquivos `.env` reais nao devem ir para o GitHub. Use apenas `.env.example` como modelo.

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no app mobile/web. Ela deve existir somente no backend.

Medidas atuais:

- Senhas novas usam `bcryptjs`; senhas antigas em SHA-256 sao migradas automaticamente no proximo login bem-sucedido.
- Login, cadastro e reset de senha possuem rate limit.
- O reset de senha agora exige codigo temporario de 6 digitos com validade de 15 minutos.
- O backend registra o codigo no log da API para ambiente local/desenvolvimento. Para producao, conecte um provedor de e-mail antes de depender desse fluxo para usuarios finais.
- Socket.IO exige JWT valido para entrar na sala do usuario.
- O token de sessao do app fica em `expo-secure-store` quando disponivel, com fallback para web.
- A API usa `helmet` e permite restringir CORS via `CORS_ORIGINS`.

Depois de aplicar estas mudancas em um banco Supabase ja existente, rode:

```sql
alter table public.users
add column if not exists password_reset_token_hash text;

alter table public.users
add column if not exists password_reset_expires_at bigint;
```

Como `expo-secure-store` adiciona modulo nativo/config plugin, gere uma nova build EAS para validar no app instalado.
