import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem, Message, Order, OrderItem, Staff, TableRow, Visit, Category } from '../lib/types';
import { beep } from '../lib/util';

export interface ServiceData {
  tables: TableRow[];
  visits: Visit[];
  orders: Order[];
  items: OrderItem[];
  messages: Message[];
  staff: Staff[];
  menu: MenuItem[];
  cats: Category[];
  restaurant: { id: string; slug: string; name: string } | null;
}

const EMPTY: ServiceData = { tables: [], visits: [], orders: [], items: [], messages: [], staff: [], menu: [], cats: [], restaurant: null };

/** Todo lo que el personal necesita, al día con Supabase Realtime. */
export function useService(rid: string | null) {
  const [data, setData] = useState<ServiceData>(EMPTY);
  const [live, setLive] = useState(false);
  const known = useRef<{ orders: Set<string>; msgs: Set<string> } | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!rid) return;
    const [r, t, v, s, m, c] = await Promise.all([
      supabase.from('restaurants').select('id,slug,name').eq('id', rid).single(),
      supabase.from('tables').select('id,number,seats,qr_key,waiter_id,label').eq('restaurant_id', rid).eq('active', true).order('number'),
      supabase.from('visits').select('*').eq('restaurant_id', rid).neq('status', 'closed').order('created_at'),
      supabase.from('staff').select('id,restaurant_id,display_name,role').eq('restaurant_id', rid),
      supabase.from('menu_items').select('id,category_id,name,description,price_cents,vat_rate,allergens,vegetarian,vegan,station,photo_url,sold_out,position,active').eq('restaurant_id', rid).eq('active', true).order('position'),
      supabase.from('menu_categories').select('id,name,position').eq('restaurant_id', rid).order('position'),
    ]);
    const visits = (v.data || []) as Visit[];
    const vids = visits.map((x) => x.id);
    let orders: Order[] = [], items: OrderItem[] = [], messages: Message[] = [];
    if (vids.length) {
      const [o, msg] = await Promise.all([
        supabase.from('orders').select('*').in('visit_id', vids).order('created_at'),
        supabase.from('messages').select('*').in('visit_id', vids).order('created_at'),
      ]);
      orders = (o.data || []) as Order[];
      messages = (msg.data || []) as Message[];
      if (orders.length) {
        const it = await supabase.from('order_items').select('*').in('order_id', orders.map((x) => x.id));
        items = (it.data || []) as OrderItem[];
      }
    }
    // sonido cuando llega un pedido nuevo o un mensaje del cliente
    if (known.current) {
      const newOrder = orders.some((o) => o.status === 'new' && !known.current!.orders.has(o.id));
      const newMsg = messages.some((m) => m.sender === 'guest' && !known.current!.msgs.has(m.id));
      if (newOrder || newMsg) beep();
    }
    known.current = { orders: new Set(orders.map((o) => o.id)), msgs: new Set(messages.map((m) => m.id)) };
    setData({
      restaurant: r.data, tables: (t.data || []) as TableRow[], visits, orders, items, messages,
      staff: (s.data || []) as Staff[], menu: (m.data || []) as MenuItem[], cats: (c.data || []) as Category[],
    });
  }, [rid]);

  const reload = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(load, 250);
  }, [load]);

  useEffect(() => {
    if (!rid) return;
    load();
    const ch = supabase.channel(`service-${rid}`);
    for (const table of ['visits', 'orders', 'order_items', 'messages', 'menu_items']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `restaurant_id=eq.${rid}` }, reload);
    }
    ch.subscribe((status) => setLive(status === 'SUBSCRIBED'));
    // respaldo por si se corta el tiempo real
    const id = window.setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); window.clearInterval(id); };
  }, [rid, load, reload]);

  return { data, live, reload: load };
}
