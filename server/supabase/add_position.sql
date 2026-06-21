alter table public.todos
add column if not exists position bigint not null default (extract(epoch from now()) * 1000)::bigint;

update public.todos
set position = created_at
where position is null;

create index if not exists todos_position_idx on public.todos(position desc);
