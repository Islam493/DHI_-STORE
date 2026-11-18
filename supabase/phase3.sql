-- =====================================================================
-- DHI Electronics — تحديث شامل (يتنفذ مرة وحدة، وما يخسر حتى معلومة)
-- آمن تعاودو: كلشي "if not exists" / "or replace"
-- =====================================================================

-- ---------- الطلبيات ----------
alter table public.orders add column if not exists history jsonb not null default '[]';
alter table public.orders add column if not exists updated_at timestamptz;
alter table public.orders add column if not exists tracking text;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists internal_note text;
alter table public.orders add column if not exists stock_applied boolean not null default false;
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_phone_idx on public.orders (phone);
create index if not exists orders_wilaya_idx on public.orders (wilaya_code);
create index if not exists orders_product_idx on public.orders (product_id);
create index if not exists orders_tracking_idx on public.orders (tracking);

-- ---------- المنتجات ----------
alter table public.products add column if not exists landing jsonb;
alter table public.products add column if not exists stock int;          -- فارغ = ما نتبعوش المخزون
alter table public.products add column if not exists low_stock int;      -- حد التنبيه
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists cost int;           -- سعر الشراء (للربح)
alter table public.products add column if not exists featured boolean not null default false;

-- ---------- آراء الزبائن ----------
create table if not exists public.reviews (
  id text primary key, created_at timestamptz not null default now(),
  product_id text, name text not null, wilaya text not null default '',
  rating int not null default 5 check (rating between 1 and 5),
  text text not null default '', image text, order_id text,
  verified boolean not null default false, visible boolean not null default true
);
create index if not exists reviews_product_idx on public.reviews (product_id);

-- ---------- المستخدمين (الفريق) ----------
create table if not exists public.admin_users (
  id text primary key,
  created_at timestamptz not null default now(),
  name text not null,
  username text unique not null,
  password_hash text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true
);

-- ---------- سجل النشاط ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_name text not null,
  action text not null,
  target text,
  details jsonb
);
create index if not exists audit_at_idx on public.audit_log (at desc);

-- ---------- حركات المخزون ----------
create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  product_id text not null,
  delta int not null,
  stock_after int,
  reason text not null,      -- order / cancel / incoming / adjust / damaged
  ref text,                  -- رقم الطلبية...
  user_name text
);
create index if not exists stock_mov_idx on public.stock_movements (product_id, at desc);

-- ---------- ملاحظات الزبائن ----------
create table if not exists public.customers (
  phone text primary key,
  note text not null default '',
  updated_at timestamptz default now()
);

-- ---------- الحماية: حتى واحد من برا ما يقرا ولا يكتب ----------
alter table public.orders enable row level security;
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_users enable row level security;
alter table public.audit_log enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customers enable row level security;

-- ---------- الإحصائيات (تتحسب فقاعدة البيانات = سريعة) ----------
create or replace function public.dhi_order_counts()
returns table(status text, n bigint) language sql stable as $$
  select status, count(*) from public.orders group by status
$$;

create or replace function public.dhi_daily(p_from timestamptz, p_to timestamptz, p_product text default null)
returns table(day date, orders bigint, confirmed bigint, delivered bigint, returned bigint, cancelled bigint,
              gross bigint, delivered_revenue bigint, delivered_product_revenue bigint, delivered_cost bigint, delivered_missing_cost bigint)
language sql stable as $$
  select (o.created_at at time zone 'Africa/Algiers')::date,
    count(*),
    count(*) filter (where o.status in ('confirmed','preparing','ready','shipped','delivered','returned')),
    count(*) filter (where o.status = 'delivered'),
    count(*) filter (where o.status = 'returned'),
    count(*) filter (where o.status in ('cancelled','cancelled_client','fake','duplicate')),
    coalesce(sum(o.total) filter (where o.status not in ('cancelled','cancelled_client','fake','duplicate')), 0),
    coalesce(sum(o.total) filter (where o.status = 'delivered'), 0),
    coalesce(sum(o.unit_price * o.quantity) filter (where o.status = 'delivered'), 0),
    coalesce(sum(p.cost * o.quantity) filter (where o.status = 'delivered'), 0),
    count(*) filter (where o.status = 'delivered' and p.cost is null)
  from public.orders o left join public.products p on p.id = o.product_id
  where o.created_at >= p_from and o.created_at < p_to and (p_product is null or o.product_id = p_product)
  group by 1 order by 1
$$;

create or replace function public.dhi_products(p_from timestamptz, p_to timestamptz)
returns table(product_id text, product_name text, orders bigint, units bigint, confirmed bigint, delivered bigint, returned bigint, cancelled bigint, delivered_revenue bigint)
language sql stable as $$
  select o.product_id, max(o.product_name), count(*), coalesce(sum(o.quantity), 0),
    count(*) filter (where o.status in ('confirmed','preparing','ready','shipped','delivered','returned')),
    count(*) filter (where o.status = 'delivered'),
    count(*) filter (where o.status = 'returned'),
    count(*) filter (where o.status in ('cancelled','cancelled_client','fake','duplicate')),
    coalesce(sum(o.total) filter (where o.status = 'delivered'), 0)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  group by o.product_id order by 3 desc
$$;

create or replace function public.dhi_wilayas(p_from timestamptz, p_to timestamptz)
returns table(wilaya_code int, wilaya_name text, orders bigint, shipped bigint, delivered bigint, returned bigint, cancelled bigint)
language sql stable as $$
  select o.wilaya_code, max(o.wilaya_name), count(*),
    count(*) filter (where o.status in ('shipped','delivered','returned')),
    count(*) filter (where o.status = 'delivered'),
    count(*) filter (where o.status = 'returned'),
    count(*) filter (where o.status in ('cancelled','cancelled_client','fake','duplicate'))
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  group by o.wilaya_code order by 3 desc
$$;

-- المخزون: تبديل آمن (ما يهبطش تحت 0، وما يتخلطش كي يطلبو زوج فنفس الوقت)
create or replace function public.dhi_adjust_stock(p_id text, p_delta int)
returns int language plpgsql as $$
declare v int;
begin
  update public.products set stock = stock + p_delta
  where id = p_id and stock is not null and stock + p_delta >= 0
  returning stock into v;
  return v;
end $$;

-- الزبائن: ملخص من الطلبيات (بلا نسخة ثانية من المعلومات)
create or replace view public.dhi_customers with (security_invoker = true) as
select phone,
  (array_agg(customer_name order by created_at desc))[1] as name,
  (array_agg(wilaya_code order by created_at desc))[1] as wilaya_code,
  (array_agg(wilaya_name order by created_at desc))[1] as wilaya_name,
  (array_agg(address order by created_at desc))[1] as address,
  count(*) as orders,
  count(*) filter (where status = 'delivered') as delivered,
  count(*) filter (where status in ('cancelled','cancelled_client','fake','duplicate')) as cancelled,
  count(*) filter (where status = 'returned') as returned,
  coalesce(sum(total) filter (where status = 'delivered'), 0) as spent,
  max(created_at) as last_order,
  min(created_at) as first_order
from public.orders group by phone;

-- غير السيرفر تاعنا (service_role) يقدر يستعمل هادو
revoke all on public.dhi_customers from anon, authenticated;
revoke execute on function public.dhi_order_counts() from public, anon, authenticated;
revoke execute on function public.dhi_daily(timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.dhi_products(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.dhi_wilayas(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.dhi_adjust_stock(text, int) from public, anon, authenticated;
grant execute on function public.dhi_order_counts() to service_role;
grant execute on function public.dhi_daily(timestamptz, timestamptz, text) to service_role;
grant execute on function public.dhi_products(timestamptz, timestamptz) to service_role;
grant execute on function public.dhi_wilayas(timestamptz, timestamptz) to service_role;
grant execute on function public.dhi_adjust_stock(text, int) to service_role;
grant select on public.dhi_customers to service_role;

notify pgrst, 'reload schema';
