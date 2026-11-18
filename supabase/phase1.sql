-- المرحلة 1: تاريخ حالات الطلبية
alter table public.orders add column if not exists history jsonb not null default '[]';
alter table public.orders add column if not exists updated_at timestamptz;
