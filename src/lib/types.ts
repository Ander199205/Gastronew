export type I18nText = Record<string, string>;

export interface Theme {
  primary?: string;
  accent?: string;
  bg?: string;
  surface?: string;
  text?: string;
  muted?: string;
  font_heading?: string;
  font_body?: string;
  radius?: string;
  mode?: 'light' | 'dark';
  logo_url?: string;
  logo_letter?: string;
}

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: I18nText;
  address: string | null;
  city: string | null;
  imprint: string | null;
  languages: string[];
  default_language: string;
  theme: Theme;
  plan: 'carta' | 'mesa';
}

export interface Category {
  id: string;
  name: I18nText;
  position: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: I18nText;
  description: I18nText;
  price_cents: number;
  vat_rate: number;
  allergens: string[];
  vegetarian: boolean;
  vegan: boolean;
  station: 'kitchen' | 'bar';
  photo_url: string | null;
  sold_out: boolean;
  position: number;
  active?: boolean;
}

export interface NearbyPlace {
  id: string;
  kind: string;
  name: string;
  description: I18nText;
  distance_m: number | null;
  offer: I18nText | null;
  url: string | null;
}

export type OrderStatus = 'new' | 'accepted' | 'ready' | 'served' | 'cancelled';
export type VisitStatus = 'open' | 'bill_requested' | 'closed';

export interface GuestOrderLine {
  item_id: string | null;
  name: string;
  qty: number;
  unit_price_cents: number;
  vat_rate: number;
}

export interface GuestMessage {
  id: string;
  sender: 'guest' | 'staff' | 'system';
  phrase_key: string | null;
  phrase_args: Record<string, unknown> | null;
  body: string | null;
  translation?: Record<string, string> | null;
  created_at: string;
  staff: string | null;
}

export interface GuestState {
  visit: {
    status: VisitStatus;
    guest_name: string | null;
    guests: number;
    table: number;
    waiter: string | null;
    tip_percent: number;
    rating: number | null;
    pay_at?: 'table' | 'counter' | null;
    regular?: boolean;
    created_at: string;
  };
  orders: {
    id: string;
    number: number;
    status: OrderStatus;
    source: 'guest' | 'waiter';
    created_at: string;
    items: GuestOrderLine[];
  }[];
  messages: GuestMessage[];
}

// filas que lee el personal
export interface Staff {
  id: string;
  restaurant_id: string;
  display_name: string;
  role: 'owner' | 'manager' | 'waiter' | 'kitchen';
  email?: string | null;
  active?: boolean;
}
export interface TableRow {
  id: string;
  number: number;
  seats: number;
  qr_key: string;
  waiter_id: string | null;
  label: string | null;
}
export interface Visit {
  id: string;
  table_id: string;
  waiter_id: string | null;
  guest_name: string | null;
  guests: number;
  language: string;
  opened_by: 'guest' | 'waiter';
  status: VisitStatus;
  tip_percent: number;
  created_at: string;
  bill_requested_at: string | null;
  pay_at?: 'table' | 'counter' | null;
  guest_profile_id?: string | null;
}
export interface Order {
  id: string;
  visit_id: string;
  table_id: string;
  number: number;
  source: 'guest' | 'waiter';
  status: OrderStatus;
  note: string | null;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
}
export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  unit_price_cents: number;
  vat_rate: number;
  qty: number;
  station: 'kitchen' | 'bar';
  note: string | null;
}
export interface Message {
  id: string;
  visit_id: string;
  sender: 'guest' | 'staff' | 'system';
  staff_id: string | null;
  phrase_key: string | null;
  phrase_args: Record<string, unknown> | null;
  body: string | null;
  translation?: Record<string, string> | null;
  source_lang?: string | null;
  read_by_staff: boolean;
  created_at: string;
}
