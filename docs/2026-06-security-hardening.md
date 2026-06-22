# TaskHub - endurecimento de seguranca

Data: 2026-06-20

Este documento resume as protecoes adicionadas depois da revisao de seguranca.

## Backend

- `helmet` foi habilitado para headers HTTP defensivos.
- `express-rate-limit` foi aplicado em cadastro, login e reset de senha.
- `trust proxy` foi configurado para funcionar corretamente atras do Render.
- `CORS_ORIGINS` permite restringir as origens aceitas pela API. Se ficar vazio, a API continua permissiva para facilitar app mobile/local.
- Socket.IO agora aceita apenas autenticacao por JWT; o fallback antigo por `userId` foi removido.

## Senhas

- Novas senhas usam `bcryptjs`.
- Senhas antigas em SHA-256 continuam validas temporariamente.
- No proximo login bem-sucedido de uma conta antiga, a senha e regravada automaticamente em bcrypt.
- `BCRYPT_ROUNDS` controla o custo e o padrao e `12`.

## Reset de senha

O fluxo antigo permitia trocar senha apenas sabendo o e-mail. Isso foi removido.

Fluxo atual:

1. App chama `POST /auth/reset-password/request` com o telefone.
2. Se `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_VERIFY_SERVICE_SID` estiverem configurados, a API envia o codigo por SMS via Twilio Verify.
3. Sem Twilio configurado, a API gera um codigo numerico de 6 digitos, salva somente o hash, define expiracao de 15 minutos e escreve o codigo no log do terminal para teste local.
4. App chama `PATCH /auth/reset-password` com telefone, codigo e nova senha.
5. Com Twilio, a API valida o codigo no Twilio Verify; sem Twilio, valida contra o hash local.
6. Se o codigo bater, a senha e atualizada com bcrypt e o codigo local e invalidado quando aplicavel.

Para producao sem dominio de e-mail, o caminho recomendado e SMS via Twilio Verify.

## Supabase

Para bancos ja existentes, rode:

```sql
alter table public.users
add column if not exists password_reset_token_hash text;

alter table public.users
add column if not exists password_reset_expires_at bigint;

alter table public.users
add column if not exists phone text;

create unique index if not exists users_phone_unique_idx
on public.users(phone)
where phone is not null;
```

O arquivo pronto esta em:

- `server/supabase/add_security_password_reset.sql`
- `server/supabase/add_user_phone.sql`

O `schema.sql` principal tambem foi atualizado.

Usuarios antigos precisam receber um telefone no formato internacional, como `+5511999999999`, para usar recuperacao por SMS.

## App

- O JWT de sessao agora usa `expo-secure-store` quando disponivel.
- O `userId` continua no AsyncStorage porque nao e segredo.
- Existe fallback para AsyncStorage quando SecureStore nao estiver disponivel, como no Expo Web.
- Tokens antigos em AsyncStorage sao migrados automaticamente para SecureStore no proximo carregamento do app.
- Como `expo-secure-store` e um modulo nativo/config plugin, gere uma nova build EAS para garantir o suporte no app instalado.

## Twilio Verify

Variaveis usadas pela API:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu-auth-token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Se elas nao estiverem preenchidas, o fluxo continua funcionando em modo local com codigo no terminal da API.

## Limitacoes restantes

- `CORS_ORIGINS` precisa ser preenchido no Render se houver frontend web publico.
- Tokens JWT ainda duram 30 dias e nao ha lista de revogacao. Para maior seguranca, reduzir expiracao e implementar refresh/revogacao.
