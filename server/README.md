# TaskHub API

Backend Express usado pelo app TaskHub.

## Bancos suportados

- Supabase, usado no ambiente atual.
- MongoDB Atlas, mantido como fallback.

O provider e escolhido por `DB_PROVIDER` em `server/.env`.

## Setup com Supabase

Copie o exemplo de ambiente:

```bash
cp server/.env.example server/.env
```

Configure:

```env
DB_PROVIDER=supabase
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
JWT_SECRET=uma-chave-grande
PORT=4000
```

Crie as tabelas no Supabase com:

```sql
server/supabase/schema.sql
```

Se o banco ja existia antes da coluna de finalizacao, rode tambem:

```sql
server/supabase/add_completed_at.sql
```

## Setup com MongoDB

Configure:

```env
DB_PROVIDER=mongodb
MONGODB_URI=mongodb://...
JWT_SECRET=uma-chave-grande
PORT=4000
```

Depois rode:

```bash
npm --prefix server run migrate
```

## Rodar localmente

```bash
npm --prefix server install
npm --prefix server run dev
```

No celular fisico, o app precisa acessar o IP da sua maquina na rede:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_DA_REDE:4000
```

No emulador Android:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

`CLOUDINARY_URL` e opcional. Sem ela, o avatar ainda funciona, mas fica salvo no banco como data URL.
