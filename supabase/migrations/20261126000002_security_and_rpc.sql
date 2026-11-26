-- abWeb Gastro: RLS, funciones del cliente (guest_*) y del personal (staff_*), realtime

-- ---------------------------------------------------------------- ayudantes
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function public.staff_role_in(rid uuid)
returns public.staff_role language sql stable security definer set search_path = '' as $$
  select role from public.staff
  where restaurant_id = rid and user_id = (select auth.uid()) and active
  limit 1;
$$;

create or replace function public.is_staff_of(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.staff_role_in(rid) is not null or public.is_platform_admin();
$$;

create or replace function public.is_manager_of(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role_in(rid) in ('owner', 'manager'), false) or public.is_platform_admin();
$$;

-- ---------------------------------------------------------------- RLS
alter table public.restaurants enable row level security;
alter table public.platform_admins enable row level security;
alter table public.staff enable row level security;
alter table public.tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.nearby_places enable row level security;
alter table public.visits enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.messages enable row level security;

-- restaurantes: la carta es pública
create policy "restaurants public read" on public.restaurants for select
  using (active or public.is_staff_of(id));
create policy "restaurants manager update" on public.restaurants for update to authenticated
  using (public.is_manager_of(id)) with check (public.is_manager_of(id));
create policy "restaurants admin insert" on public.restaurants for insert to authenticated
  with check (public.is_platform_admin());
create policy "restaurants admin delete" on public.restaurants for delete to authenticated
  using (public.is_platform_admin());

create policy "admins read self" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "staff read" on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff_of(restaurant_id));
create policy "staff manage" on public.staff for all to authenticated
  using (public.is_manager_of(restaurant_id)) with check (public.is_manager_of(restaurant_id));

-- mesas: solo personal (la clave del QR no es pública)
create policy "tables staff read" on public.tables for select to authenticated
  using (public.is_staff_of(restaurant_id));
create policy "tables manage" on public.tables for all to authenticated
  using (public.is_manager_of(restaurant_id)) with check (public.is_manager_of(restaurant_id));

-- carta y planes cercanos: lectura pública de lo activo
create policy "categories public read" on public.menu_categories for select
  using ((active and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.active))
         or public.is_staff_of(restaurant_id));
create policy "categories manage" on public.menu_categories for all to authenticated
  using (public.is_manager_of(restaurant_id)) with check (public.is_manager_of(restaurant_id));

create policy "items public read" on public.menu_items for select
  using ((active and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.active))
         or public.is_staff_of(restaurant_id));
create policy "items manage" on public.menu_items for all to authenticated
  using (public.is_manager_of(restaurant_id)) with check (public.is_manager_of(restaurant_id));

create policy "nearby public read" on public.nearby_places for select
  using ((active and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.active))
         or public.is_staff_of(restaurant_id));
create policy "nearby manage" on public.nearby_places for all to authenticated
  using (public.is_manager_of(restaurant_id)) with check (public.is_manager_of(restaurant_id));

-- servicio: el personal lee; las escrituras van por funciones staff_*
create policy "visits staff read" on public.visits for select to authenticated
  using (public.is_staff_of(restaurant_id));
create policy "orders staff read" on public.orders for select to authenticated
  using (public.is_staff_of(restaurant_id));
create policy "order_items staff read" on public.order_items for select to authenticated
  using (public.is_staff_of(restaurant_id));
create policy "messages staff read" on public.messages for select to authenticated
  using (public.is_staff_of(restaurant_id));

-- ---------------------------------------------------------------- internas
create or replace function public._visit_by_token(p_token uuid)
returns public.visits language sql stable security definer set search_path = '' as $$
  select * from public.visits where guest_token = p_token;
$$;

-- inserta un pedido validando cada plato y tomando el precio de la carta
create or replace function public._insert_order(
  p_visit public.visits, p_items jsonb, p_note text, p_source public.order_source, p_staff uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order uuid;
  v_num int;
  v_line jsonb;
  v_item public.menu_items;
  v_qty int;
  v_count int := 0;
begin
  if p_visit.status = 'closed' then raise exception 'visit_closed'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_order'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'too_many_lines'; end if;

  perform pg_advisory_xact_lock(hashtext('order-number-' || p_visit.restaurant_id::text));
  select coalesce(max(number), 0) + 1 into v_num from public.orders
  where restaurant_id = p_visit.restaurant_id
    and (created_at at time zone 'Europe/Berlin')::date = (now() at time zone 'Europe/Berlin')::date;

  insert into public.orders (restaurant_id, visit_id, table_id, number, source, created_by, note)
  values (p_visit.restaurant_id, p_visit.id, p_visit.table_id, v_num, p_source, p_staff,
          nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into v_order;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_line ->> 'qty')::int, 1);
    if v_qty < 1 or v_qty > 50 then raise exception 'bad_qty'; end if;
    select * into v_item from public.menu_items
      where id = (v_line ->> 'item_id')::uuid and restaurant_id = p_visit.restaurant_id and active;
    if not found then raise exception 'unknown_item'; end if;
    if v_item.sold_out then raise exception 'sold_out:%', v_item.id; end if;
    insert into public.order_items (order_id, restaurant_id, menu_item_id, name, unit_price_cents, vat_rate, qty, station, note)
    values (v_order, p_visit.restaurant_id, v_item.id, coalesce(v_item.name ->> 'de', v_item.name ->> 'en'),
            v_item.price_cents, v_item.vat_rate, v_qty, v_item.station,
            nullif(left(trim(coalesce(v_line ->> 'note', '')), 200), ''));
    v_count := v_count + 1;
  end loop;

  -- si el cliente pide más después de pedir la cuenta, la visita vuelve a abierta
  if p_visit.status = 'bill_requested' then
    update public.visits set status = 'open', bill_requested_at = null where id = p_visit.id;
  end if;
  return v_order;
end $$;

-- ---------------------------------------------------------------- cliente
create or replace function public.guest_open(
  p_slug text, p_table int, p_key text, p_name text default null, p_guests int default 2, p_lang text default 'de')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_r public.restaurants;
  v_t public.tables;
  v_v public.visits;
  v_joined boolean := false;
begin
  select * into v_r from public.restaurants where slug = lower(p_slug) and active;
  if not found then raise exception 'unknown_restaurant'; end if;
  if v_r.plan <> 'mesa' then raise exception 'ordering_disabled'; end if;
  select * into v_t from public.tables
    where restaurant_id = v_r.id and number = p_table and qr_key = p_key and active;
  if not found then raise exception 'invalid_table'; end if;

  select * into v_v from public.visits where table_id = v_t.id and status <> 'closed';
  if found then
    v_joined := true;
  else
    insert into public.visits (restaurant_id, table_id, waiter_id, guest_name, guests, language, opened_by)
    values (v_r.id, v_t.id, v_t.waiter_id, nullif(left(trim(coalesce(p_name, '')), 40), ''),
            greatest(1, least(coalesce(p_guests, 2), 30)),
            case when p_lang = any (v_r.languages) then p_lang else v_r.default_language end, 'guest')
    returning * into v_v;
    insert into public.messages (restaurant_id, visit_id, sender, phrase_key, phrase_args)
    values (v_r.id, v_v.id, 'system', 'sys_checkin',
            jsonb_build_object('name', coalesce(v_v.guest_name, ''), 'guests', v_v.guests));
  end if;
  return jsonb_build_object('token', v_v.guest_token, 'joined', v_joined);
end $$;

create or replace function public.guest_state(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.visits;
  v_table int;
  v_waiter text;
begin
  v := public._visit_by_token(p_token);
  if v.id is null then return null; end if;
  -- una visita cerrada solo se ve unas horas (pantalla de gracias)
  if v.status = 'closed' and v.closed_at < now() - interval '6 hours' then return null; end if;
  select number into v_table from public.tables where id = v.table_id;
  select display_name into v_waiter from public.staff where id = v.waiter_id;
  return jsonb_build_object(
    'visit', jsonb_build_object('status', v.status, 'guest_name', v.guest_name, 'guests', v.guests,
              'table', v_table, 'waiter', v_waiter, 'tip_percent', v.tip_percent, 'rating', v.rating,
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
               'phrase_args', m.phrase_args, 'body', m.body, 'created_at', m.created_at,
               'staff', s.display_name) order by m.created_at)
      from public.messages m left join public.staff s on s.id = m.staff_id
      where m.visit_id = v.id), '[]'::jsonb)
  );
end $$;

create or replace function public.guest_place_order(p_token uuid, p_items jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  v := public._visit_by_token(p_token);
  if v.id is null then raise exception 'unknown_visit'; end if;
  return public._insert_order(v, p_items, p_note, 'guest', null);
end $$;

create or replace function public.guest_send_message(p_token uuid, p_body text default null, p_phrase_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  v := public._visit_by_token(p_token);
  if v.id is null or v.status = 'closed' then raise exception 'unknown_visit'; end if;
  if p_phrase_key is not null and p_phrase_key !~ '^q_[a-z_]{1,30}$' then raise exception 'bad_phrase'; end if;
  if p_phrase_key is null and coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  -- freno sencillo: máx. 20 mensajes por minuto y visita
  if (select count(*) from public.messages where visit_id = v.id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow_down';
  end if;
  insert into public.messages (restaurant_id, visit_id, sender, phrase_key, body)
  values (v.restaurant_id, v.id, 'guest', p_phrase_key, nullif(left(trim(coalesce(p_body, '')), 500), ''));
end $$;

create or replace function public.guest_request_bill(p_token uuid, p_tip_percent int default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  v := public._visit_by_token(p_token);
  if v.id is null or v.status = 'closed' then raise exception 'unknown_visit'; end if;
  update public.visits
    set status = 'bill_requested', bill_requested_at = now(),
        tip_percent = greatest(0, least(coalesce(p_tip_percent, 0), 30))
    where id = v.id;
  insert into public.messages (restaurant_id, visit_id, sender, phrase_key, phrase_args)
  values (v.restaurant_id, v.id, 'system', 'sys_bill', jsonb_build_object('tip', p_tip_percent));
end $$;

create or replace function public.guest_rate(p_token uuid, p_stars int)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  v := public._visit_by_token(p_token);
  if v.id is null then raise exception 'unknown_visit'; end if;
  update public.visits set rating = greatest(1, least(p_stars, 5)) where id = v.id;
end $$;

-- ---------------------------------------------------------------- personal
create or replace function public._my_staff_id(rid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.staff where restaurant_id = rid and user_id = (select auth.uid()) and active limit 1;
$$;

create or replace function public.staff_set_order_status(p_order uuid, p_status public.order_status)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found or not public.is_staff_of(o.restaurant_id) then raise exception 'forbidden'; end if;
  update public.orders set
    status = p_status,
    accepted_at = case when p_status = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
    ready_at    = case when p_status = 'ready'    then coalesce(ready_at, now())    else ready_at end,
    served_at   = case when p_status = 'served'   then coalesce(served_at, now())   else served_at end
  where id = p_order;
end $$;

create or replace function public.staff_open_visit(p_table uuid, p_guests int default 2)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.tables; v_id uuid;
begin
  select * into t from public.tables where id = p_table;
  if not found or not public.is_staff_of(t.restaurant_id) then raise exception 'forbidden'; end if;
  select id into v_id from public.visits where table_id = t.id and status <> 'closed';
  if v_id is null then
    insert into public.visits (restaurant_id, table_id, waiter_id, guests, opened_by)
    values (t.restaurant_id, t.id, coalesce(public._my_staff_id(t.restaurant_id), t.waiter_id),
            greatest(1, least(coalesce(p_guests, 2), 30)), 'waiter')
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.staff_place_order(p_visit uuid, p_items jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.visits; v_order uuid;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) then raise exception 'forbidden'; end if;
  v_order := public._insert_order(v, p_items, p_note, 'waiter', public._my_staff_id(v.restaurant_id));
  -- lo que apunta el camarero va directo a cocina
  update public.orders set status = 'accepted', accepted_at = now() where id = v_order;
  return v_order;
end $$;

create or replace function public.staff_send_message(p_visit uuid, p_body text default null, p_phrase_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) then raise exception 'forbidden'; end if;
  if p_phrase_key is null and coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  insert into public.messages (restaurant_id, visit_id, sender, staff_id, phrase_key, body, read_by_staff)
  values (v.restaurant_id, v.id, 'staff', public._my_staff_id(v.restaurant_id), p_phrase_key,
          nullif(left(trim(coalesce(p_body, '')), 500), ''), true);
  update public.messages set read_by_staff = true where visit_id = v.id and not read_by_staff;
end $$;

create or replace function public.staff_mark_read(p_visit uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) then raise exception 'forbidden'; end if;
  update public.messages set read_by_staff = true where visit_id = v.id and not read_by_staff;
end $$;

create or replace function public.staff_close_visit(p_visit uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) then raise exception 'forbidden'; end if;
  update public.visits set status = 'closed', closed_at = now() where id = v.id;
  update public.orders set status = 'served', served_at = coalesce(served_at, now())
    where visit_id = v.id and status in ('new', 'accepted', 'ready');
  insert into public.messages (restaurant_id, visit_id, sender, phrase_key)
  values (v.restaurant_id, v.id, 'system', 'sys_closed');
end $$;

create or replace function public.staff_set_sold_out(p_item uuid, p_sold_out boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.menu_items;
begin
  select * into i from public.menu_items where id = p_item;
  if not found or not public.is_staff_of(i.restaurant_id) then raise exception 'forbidden'; end if;
  update public.menu_items set sold_out = p_sold_out where id = p_item;
end $$;

-- ---------------------------------------------------------------- permisos
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_platform_admin() to anon, authenticated;
grant execute on function public.staff_role_in(uuid) to anon, authenticated;
grant execute on function public.is_staff_of(uuid) to anon, authenticated;
grant execute on function public.is_manager_of(uuid) to anon, authenticated;

grant execute on function public.guest_open(text, int, text, text, int, text) to anon, authenticated;
grant execute on function public.guest_state(uuid) to anon, authenticated;
grant execute on function public.guest_place_order(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.guest_send_message(uuid, text, text) to anon, authenticated;
grant execute on function public.guest_request_bill(uuid, int) to anon, authenticated;
grant execute on function public.guest_rate(uuid, int) to anon, authenticated;

grant execute on function public.staff_set_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.staff_open_visit(uuid, int) to authenticated;
grant execute on function public.staff_place_order(uuid, jsonb, text) to authenticated;
grant execute on function public.staff_send_message(uuid, text, text) to authenticated;
grant execute on function public.staff_mark_read(uuid) to authenticated;
grant execute on function public.staff_close_visit(uuid) to authenticated;
grant execute on function public.staff_set_sold_out(uuid, boolean) to authenticated;

-- las funciones nuevas no se abren solas a anon
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------- realtime (app del personal)
alter publication supabase_realtime add table public.visits, public.orders, public.order_items, public.messages, public.menu_items;
