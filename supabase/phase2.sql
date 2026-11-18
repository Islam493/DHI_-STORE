-- المرحلة 2: صفحات الهبوط + آراء الزبائن (+ تاريخ الحالات إذا مازال)
alter table public.orders add column if not exists history jsonb not null default '[]';
alter table public.orders add column if not exists updated_at timestamptz;
alter table public.products add column if not exists landing jsonb;

create table if not exists public.reviews (
  id text primary key,
  created_at timestamptz not null default now(),
  product_id text,
  name text not null,
  wilaya text not null default '',
  rating int not null default 5 check (rating between 1 and 5),
  text text not null default '',
  image text,
  order_id text,
  verified boolean not null default false,
  visible boolean not null default true
);
alter table public.reviews enable row level security;
create index if not exists reviews_product_idx on public.reviews (product_id);
