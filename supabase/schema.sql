-- Eden Captação · esquema de base de datos
-- Pegar entero en Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  folder text not null default '',
  status text not null default 'ativo' check (status in ('ativo','pausado')),
  lang text not null default 'es' check (lang in ('es','pt')),
  fields jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  created_at timestamptz not null default now(),
  answers jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  event_id text not null,
  meta_status text not null default 'off' check (meta_status in ('enviado','erro','off')),
  meta_error text,
  ip text,
  user_agent text
);
create index if not exists responses_form_idx on responses(form_id, created_at desc);

create table if not exists form_events (
  id bigserial primary key,
  form_id uuid not null references forms(id) on delete cascade,
  session text not null,
  kind text not null check (kind in ('view','step')),
  step int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists form_events_idx on form_events(form_id, created_at desc);

create table if not exists activity (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  text text not null,
  form_id uuid references forms(id) on delete set null
);
create index if not exists activity_idx on activity(created_at desc);

-- Nadie accede desde el navegador: solo el servidor, con la clave service_role.
alter table forms enable row level security;
alter table responses enable row level security;
alter table form_events enable row level security;
alter table activity enable row level security;

-- Formulario de ejemplo (en pausa). Revisa las preguntas y el píxel antes de activarlo.
insert into forms (name, slug, folder, status, lang, fields, settings) values (
  'E-commerce de Moda (España)', 'moda-espana', 'España', 'pausado', 'es',
  '[
    {"id":"nombre","type":"text","label":"¿Cómo te llamas?","required":true},
    {"id":"instagram","type":"instagram","label":"¿Cuál es el @ de tu empresa en Instagram?","required":true},
    {"id":"telefono","type":"phone","label":"¿Cuál es tu número de teléfono?","required":true},
    {"id":"email","type":"email","label":"¿Y tu e-mail?","required":true},
    {"id":"facturacion","type":"select","label":"¿Cuál es la facturación mensual de tu e-commerce?","required":true,"options":["Menos de 10.000 €","10.000 € – 30.000 €","30.000 € – 100.000 €","Más de 100.000 €"]},
    {"id":"inversion","type":"select","label":"¿Puedes invertir al menos 1.500 €/mes en anuncios?","required":true,"options":["Sí","Todavía no"]},
    {"id":"rgpd","type":"consent","label":"Protección de datos","required":true,"text":"Acepto que EC Digital Performance, SL (Eden) trate mis datos para contactarme sobre sus servicios y que los comparta de forma cifrada con Meta para medir sus campañas, según la política de privacidad. Puedo retirar mi consentimiento en cualquier momento."}
  ]'::jsonb,
  '{"thanks":"Gracias. Te escribimos en menos de 24 horas.","redirect_url":"","pixel_id":"","capi_token":"","event_name":"Lead","test_event_code":"","notify_email":true,"notify_to":"samu@edenperformance.net","auto_reply":false,"privacy_url":"https://edenperformance.net/politica-de-privacidad/"}'::jsonb
) on conflict (slug) do nothing;
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
