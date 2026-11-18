-- التوصيل: رقم التتبع ووقت الإرسال
alter table public.orders add column if not exists tracking text;
alter table public.orders add column if not exists shipped_at timestamptz;
create index if not exists orders_tracking_idx on public.orders (tracking);
