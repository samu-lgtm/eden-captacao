-- Eden Captación · agenda (reuniones con Google Calendar)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete set null,
  response_id uuid references responses(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  google_event_id text,
  meet_link text,
  status text not null default 'confirmada' check (status in ('confirmada','cancelada')),
  created_at timestamptz not null default now()
);
create index if not exists bookings_start_idx on bookings(start_at);
create unique index if not exists bookings_response_uniq on bookings(response_id) where status = 'confirmada';
alter table bookings enable row level security;
