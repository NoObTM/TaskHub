create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  avatar_uri text,
  push_tokens text[] not null default '{}',
  password_hash text not null,
  salt text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  assignee_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  completed_at bigint,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date bigint,
  notification_id text,
  seen boolean not null default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.todos(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('created', 'updated', 'completed', 'reopened', 'deleted')),
  message text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists todos_assignee_id_idx on public.todos(assignee_id);
create index if not exists todos_creator_id_idx on public.todos(creator_id);
create index if not exists todos_created_at_idx on public.todos(created_at desc);
create index if not exists activities_todo_id_created_at_idx on public.activities(todo_id, created_at desc);

alter table public.todos add column if not exists completed_at bigint;

alter table public.users enable row level security;
alter table public.todos enable row level security;
alter table public.activities enable row level security;

grant all on table public.users to service_role;
grant all on table public.todos to service_role;
grant all on table public.activities to service_role;
