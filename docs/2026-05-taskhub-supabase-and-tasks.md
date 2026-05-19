# TaskHub - notas de mudancas

Data: 2026-05-18

Este documento resume o que foi feito para evitar precisar revisar o codigo todo nos proximos dias.

## Objetivo

Modernizar o backend para usar Supabase, manter MongoDB como fallback, melhorar o modal de criacao de tarefa no celular e registrar a data em que uma tarefa foi concluida.

## Backend

O backend agora usa uma camada de store em `server/src/store.js`.

- `DB_PROVIDER=supabase` usa Supabase via `@supabase/supabase-js`.
- Qualquer outro valor usa MongoDB/Mongoose.
- `server/src/index.js` chama `store.*` e nao depende diretamente de um banco especifico.
- `render.yaml` foi atualizado para usar `DB_PROVIDER=supabase`.

Variaveis importantes no Render/API:

```env
DB_PROVIDER=supabase
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
JWT_SECRET=uma-chave-grande
CLOUDINARY_URL=opcional
```

## Supabase

O schema principal esta em:

- `server/supabase/schema.sql`

Tabelas:

- `public.users`
- `public.todos`
- `public.activities`

Foi adicionada a coluna:

```sql
completed_at bigint
```

Ela guarda timestamp em milissegundos quando a tarefa e finalizada.

Se o banco ja existia antes dessa mudanca, rode no Supabase SQL Editor:

```sql
alter table public.todos
  add column if not exists completed_at bigint;
```

O mesmo SQL esta em:

- `server/supabase/add_completed_at.sql`

## Tarefas concluidas

Fluxo atual:

1. O app chama `PATCH /todos/:id/toggle` com `done`.
2. Se `done=true`, o backend grava `completedAt/completed_at = Date.now()`.
3. Se `done=false`, o backend limpa `completedAt/completed_at = null`.
4. O card da tarefa mostra `Finalizada em dd/mm/yy`.

Arquivos envolvidos:

- `server/src/store.js`
- `src/db/schema.ts`
- `src/components/TodoItem.tsx`

## Exclusao de tarefa propria

A regra atual permite excluir uma tarefa quando:

- voce esta na aba `assigned-by-me`; ou
- voce e o `creatorId` da tarefa.

Isso inclui tarefa criada por voce para voce mesmo, mesmo sem estar concluida.

Arquivos envolvidos:

- `src/components/TodoItem.tsx`
- `server/src/index.js`
- `server/src/store.js`

## Modal de nova tarefa

O modal `+ tarefa` foi ajustado para nao ficar coberto pelo teclado no celular.

Mudancas:

- `KeyboardAvoidingView` no modal.
- Altura maxima do sheet em 88% da tela.
- `ScrollView` com `keyboardShouldPersistTaps="handled"`.
- `android.softwareKeyboardLayoutMode` em `app.json` definido como `pan` para builds EAS Android.

Arquivo:

- `src/components/AddTaskModal.tsx`
- `app.json`

## Deploy e atualizacao do app

O app esta configurado para chamar a API publicada:

```env
EXPO_PUBLIC_API_URL=https://taskhub-api-zhz5.onrender.com
```

Para ver as mudancas no celular:

1. Rode o SQL `completed_at` no Supabase.
2. Faca push do codigo para GitHub.
3. Redeploy/restart da API no Render, se o deploy automatico nao rodar.
4. Gere nova build EAS para aplicar mudancas nativas do Android, como teclado.

Update OTA nao aplica alteracoes de `app.json` que mudam configuracao nativa Android. Para o ajuste do teclado no app instalado, gere um APK/build novo.

Comando de build Android preview:

```bash
npx eas-cli@latest build -p android --profile preview
```

## Verificacoes usadas

```bash
npx.cmd tsc --noEmit
node --check server/src/store.js
node --check server/src/migrate.js
node --check server/src/index.js
```
