-- abWeb Gastro: esquema multi-restaurante (piloto)
-- Una sola base de datos para todos los restaurantes. Cada fila lleva restaurant_id
-- y las políticas RLS limitan al personal a su restaurante.
-- Los clientes (anónimos) NO leen tablas de pedidos directamente: usan funciones
-- guest_* con un token secreto de visita.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tipos
create type public.staff_role as enum ('owner', 'manager', 'waiter', 'kitchen');
create type public.visit_status as enum ('open', 'bill_requested', 'closed');
create type public.order_status as enum ('new', 'accepted', 'ready', 'served', 'cancelled');
create type public.order_source as enum ('guest', 'waiter');
create type public.station as enum ('kitchen', 'bar');
create type public.message_sender as enum ('guest', 'staff', 'system');

-- ---------------------------------------------------------------- restaurantes
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null,
  tagline jsonb not null default '{}'::jsonb,          -- {"de": "...", "en": "..."}
  address text,
  city text,
  imprint text,                                        -- texto de Impressum / Datenschutz corto
  languages text[] not null default array['de','en','es','it','fr','tr'],
  default_language text not null default 'de',
  theme jsonb not null default '{}'::jsonb,            -- colores, letra, logo
  plan text not null default 'mesa' check (plan in ('carta', 'mesa')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index on public.staff (user_id);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  number int not null check (number > 0),
  label text,
  seats int not null default 4,
  -- clave impresa en el QR: evita que alguien pida "a la mesa 7" desde casa
  qr_key text not null default encode(extensions.gen_random_bytes(6), 'hex'),
  waiter_id uuid references public.staff (id) on delete set null,
  active boolean not null default true,
  unique (restaurant_id, number)
);

-- ---------------------------------------------------------------- carta
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name jsonb not null,                                 -- {"de": "Vorspeisen", ...}
  position int not null default 0,
  active boolean not null default true
);
create index on public.menu_categories (restaurant_id, position);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name jsonb not null,
  description jsonb not null default '{}'::jsonb,
  price_cents int not null check (price_cents >= 0),
  vat_rate numeric(4,1) not null default 7 check (vat_rate in (7, 19)),
  allergens text[] not null default '{}',              -- letras de la LMIV: A, C, G...
  vegetarian boolean not null default false,
  vegan boolean not null default false,
  station public.station not null default 'kitchen',
  photo_url text,
  sold_out boolean not null default false,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.menu_items (restaurant_id, category_id, position);

-- planes cercanos que el cliente ve al pedir la cuenta
create table public.nearby_places (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null check (kind in ('bar', 'music', 'culture', 'market', 'cinema', 'other')),
  name text not null,
  description jsonb not null default '{}'::jsonb,
  distance_m int,
  offer jsonb,                                         -- {"de": "10 % mit diesem Code"}
  url text,
  position int not null default 0,
  active boolean not null default true
);

-- ---------------------------------------------------------------- servicio
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  waiter_id uuid references public.staff (id) on delete set null,
  guest_token uuid not null default gen_random_uuid() unique,
  guest_name text check (char_length(guest_name) <= 40),
  guests int not null default 2 check (guests between 1 and 30),
  language text not null default 'de',
  opened_by public.order_source not null default 'guest',
  status public.visit_status not null default 'open',
  tip_percent int not null default 0 check (tip_percent between 0 and 30),
  review_opt_in boolean not null default false,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  bill_requested_at timestamptz,
  closed_at timestamptz
);
-- como mucho una visita abierta por mesa
create unique index visits_one_open_per_table on public.visits (table_id) where status <> 'closed';
create index on public.visits (restaurant_id, status);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  number int not null,                                 -- número corto del día para cocina
  source public.order_source not null,
  created_by uuid references public.staff (id) on delete set null,
  status public.order_status not null default 'new',
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz
);
create index on public.orders (restaurant_id, status, created_at);
create index on public.orders (visit_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,                                  -- copia en alemán para cocina y caja
  unit_price_cents int not null,
  vat_rate numeric(4,1) not null,
  qty int not null check (qty between 1 and 50),
  station public.station not null,
  note text check (char_length(note) <= 200)
);
create index on public.order_items (order_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  sender public.message_sender not null,
  staff_id uuid references public.staff (id) on delete set null,
  phrase_key text,                                     -- mensaje rápido: cada lado lo lee en su idioma
  phrase_args jsonb,
  body text check (char_length(body) <= 500),
  read_by_staff boolean not null default false,
  created_at timestamptz not null default now(),
  check (phrase_key is not null or body is not null)
);
create index on public.messages (visit_id, created_at);
