-- abWeb Gastro fase 3: alta de personal, panel admin de abWeb y traducción automática del chat

-- ---------------------------------------------------------------- personal
alter table public.staff add column if not exists email text;

-- Buscar una cuenta por e-mail (solo la usa la función staff-admin con la clave de servicio)
create or replace function public._user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public._user_id_by_email(text) from public, anon, authenticated;
grant execute on function public._user_id_by_email(text) to service_role;

-- Un encargado no puede subir a nadie a "owner" ni tocar a los dueños (solo dueños o abWeb)
create or replace function public._guard_staff_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_platform_admin() then return coalesce(new, old); end if;
  if public.staff_role_in(coalesce(new.restaurant_id, old.restaurant_id)) = 'owner' then return coalesce(new, old); end if;
  if (tg_op <> 'INSERT' and old.role = 'owner') or (tg_op <> 'DELETE' and new.role = 'owner') then
    raise exception 'only_owner';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists staff_guard on public.staff;
create trigger staff_guard before insert or update or delete on public.staff
  for each row execute function public._guard_staff_change();

-- ---------------------------------------------------------------- panel admin abWeb
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'slug', r.slug, 'name', r.name, 'city', r.city, 'plan', r.plan, 'active', r.active,
      'created_at', r.created_at,
      'staff', (select count(*) from public.staff s where s.restaurant_id = r.id and s.active),
      'tables', (select count(*) from public.tables t where t.restaurant_id = r.id and t.active),
      'items', (select count(*) from public.menu_items i where i.restaurant_id = r.id and i.active),
      'visits_30d', (select count(*) from public.visits v where v.restaurant_id = r.id and v.created_at > now() - interval '30 days'),
      'orders_30d', (select count(*) from public.orders o where o.restaurant_id = r.id and o.created_at > now() - interval '30 days'),
      'last_activity', (select max(v.created_at) from public.visits v where v.restaurant_id = r.id)
    ) order by r.created_at desc)
    from public.restaurants r), '[]'::jsonb);
end $$;
grant execute on function public.admin_overview() to authenticated;

-- ---------------------------------------------------------------- traducción del chat
alter table public.messages add column if not exists source_lang text;
alter table public.messages add column if not exists translation jsonb;   -- {"de": "…"} o {"es": "…"}

create or replace function public.guest_send_message(p_token uuid, p_body text default null, p_phrase_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  v := public._visit_by_token(p_token);
  if v.id is null or v.status = 'closed' then raise exception 'unknown_visit'; end if;
  if p_phrase_key is not null and p_phrase_key !~ '^q_[a-z_]{1,30}$' then raise exception 'bad_phrase'; end if;
  if p_phrase_key is null and coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  if (select count(*) from public.messages where visit_id = v.id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow_down';
  end if;
  insert into public.messages (restaurant_id, visit_id, sender, phrase_key, body, source_lang)
  values (v.restaurant_id, v.id, 'guest', p_phrase_key, nullif(left(trim(coalesce(p_body, '')), 500), ''), v.language);
end $$;

create or replace function public.staff_send_message(p_visit uuid, p_body text default null, p_phrase_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits; v_lang text;
begin
  select * into v from public.visits where id = p_visit;
  if not found or not public.is_staff_of(v.restaurant_id) then raise exception 'forbidden'; end if;
  if p_phrase_key is null and coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  select default_language into v_lang from public.restaurants where id = v.restaurant_id;
  insert into public.messages (restaurant_id, visit_id, sender, staff_id, phrase_key, body, read_by_staff, source_lang)
  values (v.restaurant_id, v.id, 'staff', public._my_staff_id(v.restaurant_id), p_phrase_key,
          nullif(left(trim(coalesce(p_body, '')), 500), ''), true, v_lang);
  update public.messages set read_by_staff = true where visit_id = v.id and not read_by_staff;
end $$;

-- el cliente también recibe la traducción
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
               'phrase_args', m.phrase_args, 'body', m.body, 'translation', m.translation,
               'created_at', m.created_at, 'staff', s.display_name) order by m.created_at)
      from public.messages m left join public.staff s on s.id = m.staff_id
      where m.visit_id = v.id), '[]'::jsonb)
  );
end $$;

-- Al guardar un mensaje libre, se avisa a la función translate-message (pg_net, asíncrono).
-- La URL y la clave compartida están en Vault: 'project_url' y 'translate_hook_secret'.
create extension if not exists pg_net with schema extensions;

create or replace function public._notify_translate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  if new.body is null then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'translate_hook_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/translate-message',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := jsonb_build_object('id', new.id)
  );
  return new;
exception when others then
  return new;  -- la traducción nunca debe bloquear el chat
end $$;
revoke execute on function public._notify_translate() from public, anon, authenticated;
drop trigger if exists messages_translate on public.messages;
create trigger messages_translate after insert on public.messages
  for each row execute function public._notify_translate();
