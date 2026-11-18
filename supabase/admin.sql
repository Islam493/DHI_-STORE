-- لوحة التحكم: جداول المنتجات والإعدادات + مخزن الصور
create table if not exists public.products (
  id text primary key,
  slug text unique not null,
  name text not null,
  tagline text,
  category text not null default 'cameras-wifi',
  active boolean not null default true,
  price int not null default 0,
  compare_at_price int,
  variants jsonb not null default '[]',
  images jsonb not null default '[]',
  description text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;

create table if not exists public.settings (
  id int primary key default 1,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.settings enable row level security;

create index if not exists orders_status_idx on public.orders (status);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
