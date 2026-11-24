-- =====================================================================
-- DHI Electronics — الطلبات المتروكة (يتنفذ مرة وحدة، آمن تعاودو)
-- =====================================================================
create table if not exists public.abandoned_carts (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id text not null,
  product_name text not null default '',
  product_slug text not null default '',
  variant text,
  quantity int not null default 1,
  wilaya_code int,
  wilaya_name text not null default '',
  commune text not null default '',
  delivery_method text not null default 'home',
  name text not null default '',
  phone text not null,
  total int not null default 0,
  status text not null default 'open' check (status in ('open', 'contacted', 'converted', 'ignored')),
  order_id text,
  ip text,
  contacted_at timestamptz,
  by text
);
create index if not exists abandoned_status_idx on public.abandoned_carts (status, updated_at desc);
create index if not exists abandoned_phone_idx on public.abandoned_carts (phone);

-- الحماية: حتى واحد من برا ما يقرا ولا يكتب (غير السيرفر تاع المتجر)
alter table public.abandoned_carts enable row level security;
revoke all on public.abandoned_carts from anon, authenticated;
