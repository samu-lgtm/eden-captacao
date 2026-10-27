-- Eden Captación · formularios incompletos
-- Pegar en Supabase > SQL Editor > New query > Run (una sola vez).

create table if not exists partials (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  session text not null,
  answers jsonb not null default '{}'::jsonb,
  step int not null default 0,
  contacted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, session)
);
create index if not exists partials_idx on partials(updated_at desc);
alter table partials enable row level security;
