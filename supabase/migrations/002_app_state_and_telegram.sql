create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists telegram_subscribers (
  chat_id text primary key,
  username text,
  first_name text,
  registered_at timestamptz not null default now()
);

create table if not exists telegram_bot_state (
  id text primary key,
  last_update_id bigint not null default 0,
  sent_digests jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;
alter table telegram_subscribers enable row level security;
alter table telegram_bot_state enable row level security;

create policy "service role manages app_state" on app_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages telegram_subscribers" on telegram_subscribers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages telegram_bot_state" on telegram_bot_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into telegram_bot_state (id, last_update_id, sent_digests)
values ('main', 0, '{}'::jsonb)
on conflict (id) do nothing;
