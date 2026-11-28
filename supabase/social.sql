-- =====================================================================
-- DHI Electronics — روبوت فيسبوك وانستغرام: الرسائل والكومونتيرات (آمن تعاودو)
-- =====================================================================
-- كل رسالة/كومونتير يدخل، وكل رد يخرج (من الروبوت ولا من الفريق)
create table if not exists public.social_messages (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  channel text not null,                       -- facebook | instagram
  thread text not null,                        -- facebook:<id تاع الزبون>
  kind text not null default 'dm',             -- dm | comment | private_reply | public_reply | staff
  dir text not null check (dir in ('in', 'out')),
  ext_id text,                                 -- رقم الرسالة عند Meta (باش ما نجاوبوش زوج مرات)
  post_id text,
  body text not null default '',
  intent text,
  handoff boolean not null default false,
  source text,                                 -- ai | rules | staff
  status text not null default '',
  error text
);
create unique index if not exists social_messages_in_uidx on public.social_messages (ext_id) where dir = 'in' and ext_id is not null;
create index if not exists social_messages_thread_idx on public.social_messages (thread, at desc);
create index if not exists social_messages_at_idx on public.social_messages (at desc);

-- المحادثات: شكون الزبون، آخر رسالة، واش الروبوت ساكت (الفريق يجاوب)
create table if not exists public.social_threads (
  id text primary key,
  channel text not null,
  user_id text not null,
  name text not null default '',
  last_at timestamptz not null default now(),
  last_text text not null default '',
  paused_until timestamptz,                    -- الروبوت ساكت حتى هاد الوقت
  needs_human boolean not null default false,  -- لازم واحد من الفريق يجاوب
  reason text,
  phone text,
  product text,
  updated_at timestamptz not null default now()
);
create index if not exists social_threads_last_idx on public.social_threads (last_at desc);

-- الحماية: غير السيرفر تاع المتجر يقرا ويكتب
alter table public.social_messages enable row level security;
alter table public.social_threads enable row level security;
revoke all on public.social_messages from anon, authenticated;
revoke all on public.social_threads from anon, authenticated;
