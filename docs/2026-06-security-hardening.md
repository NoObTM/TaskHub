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

1. App chama `POST /auth/reset-password/request` com o e-mail.
2. API gera um codigo numerico de 6 digitos, salva somente o hash e define expiracao de 15 minutos.
3. Em ambiente local/desenvolvimento, a API escreve o codigo no log do terminal.
4. App chama `PATCH /auth/reset-password` com e-mail, codigo e nova senha.
5. Se o codigo bater e nao estiver expirado, a senha e atualizada com bcrypt e o codigo e invalidado.

Para producao, o ideal e integrar envio de e-mail/SMS. Ate la, o codigo fica disponivel apenas nos logs da API.

## Supabase

Para bancos ja existentes, rode:

```sql
alter table public.users
add column if not exists password_reset_token_hash text;

alter table public.users
add column if not exists password_reset_expires_at bigint;
```

O arquivo pronto esta em:

- `server/supabase/add_security_password_reset.sql`

O `schema.sql` principal tambem foi atualizado.

## App

- O JWT de sessao agora usa `expo-secure-store` quando disponivel.
- O `userId` continua no AsyncStorage porque nao e segredo.
- Existe fallback para AsyncStorage quando SecureStore nao estiver disponivel, como no Expo Web.
- Tokens antigos em AsyncStorage sao migrados automaticamente para SecureStore no proximo carregamento do app.
- Como `expo-secure-store` e um modulo nativo/config plugin, gere uma nova build EAS para garantir o suporte no app instalado.

## Limitacoes restantes

- O app ainda nao possui provedor real de e-mail para reset de senha em producao.
- `CORS_ORIGINS` precisa ser preenchido no Render se houver frontend web publico.
- Tokens JWT ainda duram 30 dias e nao ha lista de revogacao. Para maior seguranca, reduzir expiracao e implementar refresh/revogacao.
