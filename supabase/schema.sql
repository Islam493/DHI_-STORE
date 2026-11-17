-- جدول الطلبيات — انسخ هاد الكود فـ Supabase > SQL Editor واضغط Run
create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'new',  -- new / confirmed / shipped / delivered / returned / cancelled
  customer_name text not null,
  phone text not null,
  wilaya_code int not null,
  wilaya_name text not null,
  commune text not null,
  address text,
  delivery_method text not null,
  product_id text not null,
  product_name text not null,
  variant text,
  quantity int not null,
  unit_price int not null,
  shipping_fee int not null,
  total int not null,
  note text,
  ip text
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (phone);
-- حماية: ما حد يقدر يقرا ولا يكتب من برا إلا السيرفر تاعنا (service role)
alter table public.orders enable row level security;
