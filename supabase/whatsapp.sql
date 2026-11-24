-- =====================================================================
-- DHI Electronics — الأتمتة: رسائل الواتساب + تتبع الطلبيات (آمن تعاودو)
-- =====================================================================
-- كل رسالة تخرج ولا تدخل (باش تشوف واش صرا مع كل زبون)
create table if not exists public.wa_messages (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  order_id text,
  phone text not null,
  dir text not null check (dir in ('in', 'out')),
  kind text not null default '',
  body text not null default '',
  wa_id text,
  status text not null default '',
  error text
);
create index if not exists wa_messages_order_idx on public.wa_messages (order_id, at desc);
create index if not exists wa_messages_wa_idx on public.wa_messages (wa_id);
create index if not exists wa_messages_at_idx on public.wa_messages (at desc);

-- حالة الأتمتة لكل طلبية (واش تبعث التأكيد، التذكير، حالة شركة التوصيل...)
create table if not exists public.order_automation (
  order_id text primary key,
  flags jsonb not null default '{}',
  carrier_status text,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists order_automation_checked_idx on public.order_automation (checked_at);

-- الحماية: غير السيرفر تاع المتجر يقرا ويكتب
alter table public.wa_messages enable row level security;
alter table public.order_automation enable row level security;
revoke all on public.wa_messages from anon, authenticated;
revoke all on public.order_automation from anon, authenticated;
