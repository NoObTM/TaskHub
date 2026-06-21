alter table public.users
add column if not exists password_reset_token_hash text;

alter table public.users
add column if not exists password_reset_expires_at bigint;
