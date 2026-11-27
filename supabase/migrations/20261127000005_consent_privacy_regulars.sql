-- abWeb Gastro fase 4: el cliente acepta condiciones al entrar, sus datos se borran al pagar
-- (salvo que deje su e-mail para que le reconozcan), cliente habitual, pagar en mesa o en caja.

-- ---------------------------------------------------------------- clientes habituales
create table if not exists public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 120),
  name text check (char_length(name) <= 40),
  language text,
  consent_at timestamptz not null default now(),        -- consentimiento expreso (casilla)
  confirmed_at timestamptz,                             -- doble opt-in: hasta confirmar el enlace del e-mail no se usa
  confirm_token uuid not null default gen_random_uuid(),
  confirm_sent_at timestamptz,
  visits int not null default 1,
  last_visit_at timestamptz not null default now(),
  note text check (char_length(note) <= 300),           -- nota del personal ("mesa junto a la ventana")
  created_at timestamptz not null default now()
);
create unique index if not exists guest_profiles_email on public.guest_profiles (restaurant_id, lower(email));

-- llave guardada en el móvil del cliente para reconocerle (una por dispositivo)
create table if not exists public.guest_profile_keys (
  key uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.visits add column if not exists terms_accepted_at timestamptz;
alter table public.visits add column if not exists pay_at text check (pay_at in ('table', 'counter'));
alter table public.visits add column if not exists guest_profile_id uuid references public.guest_profiles (id) on delete set null;
create index if not exists visits_profile on public.visits (guest_profile_id);

alter table public.guest_profiles enable row level security;
alter table public.guest_profile_keys enable row level security;
-- el personal ve a los habituales de su restaurante; solo dueños/encargados los cambian o borran
create policy "profiles staff read" on public.guest_profiles for select to authenticated
  using (public.is_staff_of(restaurant_id));
create policy "profiles staff update" on public.guest_profiles for update to authenticated
  using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));
create policy "profiles manager delete" on public.guest_profiles for delete to authenticated
  using (public.is_manager_of(restaurant_id));
-- guest_profile_keys: sin políticas = nadie desde fuera, solo funciones

-- Llama a una Edge Function desde la base de datos (pg_net, asíncrono). URL y clave en Vault.
create or replace function public._call_function(p_name text, p_body jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'translate_hook_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret), body := p_body);
exception when others then return;
end $$;
revoke execute on function public._call_function(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- borrar datos del cliente
-- Borra nombre y chat de una visita (no los pedidos: son la base de la caja/contabilidad, sin datos personales).
create or replace function public._purge_visit(p_visit uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.messages where visit_id = p_visit;
  update public.visits set guest_name = null where id = p_visit;
end $$;
revoke execute on function public._purge_visit(uuid) from public, anon, authenticated;

-- Visitas olvidadas abiertas más de 12 h: se cierran y se borran igual.
create or replace function public.purge_stale_visits()
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; v record;
begin
  for v in select id from public.visits where status <> 'closed' and created_at < now() - interval '12 hours' loop
    update public.visits set status = 'closed', closed_at = now() where id = v.id;
    perform public._purge_visit(v.id);
    n := n + 1;
  end loop;
  -- por si acaso: ningún chat ni nombre de visitas cerradas hace más de 1 h
  delete from public.messages m using public.visits x
    where m.visit_id = x.id and x.status = 'closed' and x.closed_at < now() - interval '1 hour';
  update public.visits set guest_name = null
    where status = 'closed' and closed_at < now() - interval '1 hour' and guest_name is not null;
  -- e-mails nunca confirmados: fuera a las 48 h
  delete from public.guest_profiles where confirmed_at is null and created_at < now() - interval '48 hours';
  return n;
end $$;
revoke execute on function public.purge_stale_visits() from public, anon, authenticated;

-- ---------------------------------------------------------------- cliente: entrar (con aceptación)
drop function if exists public.guest_open(text, int, text, text, int, text);
create or replace function public.guest_open(
  p_slug text, p_table int, p_key text, p_name text default null, p_guests int default 2, p_lang text default 'de',
  p_accept boolean default false, p_profile_key uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_r public.restaurants;
  v_t public.tables;
  v_v public.visits;
  v_p public.guest_profiles;
  v_joined boolean := false;
begin
  if not coalesce(p_accept, false) then raise exception 'terms_required'; end if;
  select * into v_r from public.restaurants where slug = lower(p_slug) and active;
  if not found then raise exception 'unknown_restaurant'; end if;
  if v_r.plan <> 'mesa' then raise exception 'ordering_disabled'; end if;
  select * into v_t from public.tables
    where restaurant_id = v_r.id and number = p_table and qr_key = p_key and active;
  if not found then raise exception 'invalid_table'; end if;

  if p_profile_key is not null then
    select p.* into v_p from public.guest_profile_keys k join public.guest_profiles p on p.id = k.profile_id
      where k.key = p_profile_key and p.restaurant_id = v_r.id and p.confirmed_at is not null;
  end if;

  select * into v_v from public.visits where table_id = v_t.id and status <> 'closed';
  if found then
    v_joined := true;
  else
    insert into public.visits (restaurant_id, table_id, waiter_id, guest_name, guests, language, opened_by,
                               terms_accepted_at, guest_profile_id)
    values (v_r.id, v_t.id, v_t.waiter_id,
            coalesce(nullif(left(trim(coalesce(p_name, '')), 40), ''), v_p.name),
            greatest(1, least(coalesce(p_guests, 2), 30)),
            case when p_lang = any (v_r.languages) then p_lang else v_r.default_language end, 'guest',
            now(), v_p.id)
    returning * into v_v;
    if v_p.id is not null then
      update public.guest_profiles set visits = visits + 1, last_visit_at = now(), language = v_v.language where id = v_p.id;
    end if;
    insert into public.messages (restaurant_id, visit_id, sender, phrase_key, phrase_args)
    values (v_r.id, v_v.id, 'system', 'sys_checkin',
            jsonb_build_object('name', coalesce(v_v.guest_name, ''), 'guests', v_v.guests, 'regular', v_p.id is not null));
  end if;
  return jsonb_build_object('token', v_v.guest_token, 'joined', v_joined,
                            'regular_name', case when v_p.id is not null then v_p.name end);
end $$;

-- ---------------------------------------------------------------- cliente: pedir la cuenta (mesa o caja)
drop function if exists public.guest_request_bill(uuid, int);
create or replace function public.guest_request_bill(p_token uuid, p_tip_percent int default 0, p_pay_at text default 'table')
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits; v_at text := case when p_pay_at = 'counter' then 'counter' else 'table' end;
begin
  v := public._visit_by_token(p_token);
  if v.id is null or v.status = 'closed' then raise exception 'unknown_visit'; end if;
  update public.visits
    set status = 'bill_requested', bill_requested_at = now(), pay_at = v_at,
        tip_percent = greatest(0, least(coalesce(p_tip_percent, 0), 30))
    where id = v.id;
  insert into public.messages (restaurant_id, visit_id, sender, phrase_key, phrase_args)
  values (v.restaurant_id, v.id, 'system', 'sys_bill', jsonb_build_object('tip', p_tip_percent, 'at', v_at));
end $$;

-- ---------------------------------------------------------------- cliente: dejar su e-mail / borrarse
create or replace function public.guest_save_profile(p_token uuid, p_email text, p_name text default null, p_consent boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.visits; v_p public.guest_profiles; v_email text := lower(trim(coalesce(p_email, ''))); v_key uuid;
begin
  if not coalesce(p_consent, false) then raise exception 'consent_required'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 120 then raise exception 'bad_email'; end if;
  v := public._visit_by_token(p_token);
  if v.id is null or (v.status = 'closed' and v.closed_at < now() - interval '6 hours') then raise exception 'unknown_visit'; end if;
  select * into v_p from public.guest_profiles where restaurant_id = v.restaurant_id and lower(email) = v_email;
  if found then
    -- e-mail ya conocido: se une la visita, el nombre no se pisa
    update public.guest_profiles set consent_at = now(), last_visit_at = now(),
      name = coalesce(name, nullif(left(trim(coalesce(p_name, '')), 40), ''))
      where id = v_p.id returning * into v_p;
  else
    insert into public.guest_profiles (restaurant_id, email, name, language)
    values (v.restaurant_id, v_email, nullif(left(trim(coalesce(p_name, v.guest_name, '')), 40), ''), v.language)
    returning * into v_p;
  end if;
  -- doble opt-in: correo con el enlace (como mucho uno cada 10 minutos)
  if v_p.confirmed_at is null and (v_p.confirm_sent_at is null or v_p.confirm_sent_at < now() - interval '10 minutes') then
    update public.guest_profiles set confirm_sent_at = now() where id = v_p.id;
    perform public._call_function('send-confirmation', jsonb_build_object('profile_id', v_p.id));
  end if;
  if v.guest_profile_id is null then update public.visits set guest_profile_id = v_p.id where id = v.id; end if;
  insert into public.guest_profile_keys (profile_id) values (v_p.id) returning key into v_key;
  return v_key;
end $$;

create or replace function public.guest_confirm(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p public.guest_profiles; v_r public.restaurants;
begin
  update public.guest_profiles set confirmed_at = coalesce(confirmed_at, now())
    where confirm_token = p_token returning * into v_p;
  if v_p.id is null then return null; end if;
  select * into v_r from public.restaurants where id = v_p.restaurant_id;
  return jsonb_build_object('restaurant', v_r.name, 'slug', v_r.slug, 'name', v_p.name, 'language', v_p.language);
end $$;

create or replace function public.guest_forget(p_profile_key uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select profile_id into v_id from public.guest_profile_keys where key = p_profile_key;
  if v_id is null then return; end if;
  update public.visits set guest_profile_id = null, guest_name = null where guest_profile_id = v_id;
  delete from public.guest_profiles where id = v_id;
end $$;

-- ---------------------------------------------------------------- personal: cerrar y ver al habitual
create or replace function public.staff_close_visit(p_visit uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) then raise exception 'forbidden'; end if;
  update public.visits set status = 'closed', closed_at = now() where id = v.id;
  update public.orders set status = 'served', served_at = coalesce(served_at, now())
    where visit_id = v.id and status in ('new', 'accepted', 'ready');
  perform public._purge_visit(v.id);   -- nombre y chat fuera al pagar
  insert into public.messages (restaurant_id, visit_id, sender, phrase_key)
  values (v.restaurant_id, v.id, 'system', 'sys_closed');
end $$;

-- Ficha del habitual para el personal: nombre, visitas, platos favoritos y nota (sin e-mail).
create or replace function public.staff_regular(p_visit uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.visits; p public.guest_profiles;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) or v.guest_profile_id is null then return null; end if;
  select * into p from public.guest_profiles where id = v.guest_profile_id and confirmed_at is not null;
  if p.id is null then return null; end if;
  return jsonb_build_object('id', p.id, 'name', p.name, 'visits', p.visits, 'since', p.created_at, 'note', p.note,
    'language', p.language,
    'favorites', coalesce((
      select jsonb_agg(x.name) from (
        select i.name, sum(i.qty) q from public.order_items i
          join public.orders o on o.id = i.order_id join public.visits vv on vv.id = o.visit_id
          where vv.guest_profile_id = p.id and o.status <> 'cancelled'
          group by i.name order by q desc limit 3) x), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- estado para el cliente (+ pay_at, regular)
create or replace function public.guest_state(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.visits;
  v_table int;
  v_waiter text;
begin
  v := public._visit_by_token(p_token);
  if v.id is null then return null; end if;
  if v.status = 'closed' and v.closed_at < now() - interval '6 hours' then return null; end if;
  select number into v_table from public.tables where id = v.table_id;
  select display_name into v_waiter from public.staff where id = v.waiter_id;
  return jsonb_build_object(
    'visit', jsonb_build_object('status', v.status, 'guest_name', v.guest_name, 'guests', v.guests,
              'table', v_table, 'waiter', v_waiter, 'tip_percent', v.tip_percent, 'rating', v.rating, 'pay_at', v.pay_at,
              'regular', v.guest_profile_id is not null,
              'created_at', v.created_at),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status,
               'source', o.source, 'created_at', o.created_at,
               'items', (select jsonb_agg(jsonb_build_object('item_id', i.menu_item_id, 'name', i.name,
                          'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'vat_rate', i.vat_rate))
                         from public.order_items i where i.order_id = o.id))
             order by o.created_at)
      from public.orders o where o.visit_id = v.id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'phrase_key', m.phrase_key,
               'phrase_args', m.phrase_args, 'body', m.body, 'translation', m.translation,
               'created_at', m.created_at, 'staff', s.display_name) order by m.created_at)
      from public.messages m left join public.staff s on s.id = m.staff_id
      where m.visit_id = v.id), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- permisos
revoke execute on function public.guest_open(text, int, text, text, int, text, boolean, uuid) from public;
revoke execute on function public.guest_request_bill(uuid, int, text) from public;
revoke execute on function public.guest_save_profile(uuid, text, text, boolean) from public;
revoke execute on function public.guest_forget(uuid) from public;
revoke execute on function public.guest_confirm(uuid) from public;
grant execute on function public.guest_confirm(uuid) to anon, authenticated;
revoke execute on function public.staff_regular(uuid) from public;
grant execute on function public.guest_open(text, int, text, text, int, text, boolean, uuid) to anon, authenticated;
grant execute on function public.guest_request_bill(uuid, int, text) to anon, authenticated;
grant execute on function public.guest_save_profile(uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.guest_forget(uuid) to anon, authenticated;
grant execute on function public.staff_regular(uuid) to authenticated;

-- ---------------------------------------------------------------- limpieza automática cada hora
create extension if not exists pg_cron;
select cron.schedule('abg-purge-guest-data', '17 * * * *', 'select public.purge_stale_visits()')
  where not exists (select 1 from cron.job where jobname = 'abg-purge-guest-data');
