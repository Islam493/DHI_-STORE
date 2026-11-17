# DHI Electronics — المتجر

متجر إلكتروني خاص (Next.js) — الدفع عند الاستلام، 58 ولاية، فورم طلب سريع.

## التشغيل على الكمبيوتر
```bash
npm install
cp .env.example .env.local
npm run dev
```
ثم افتح http://localhost:3000

## وين نبدّل؟
| واش | الملف |
|---|---|
| المنتجات (الأسماء، الأسعار، الصور، الوصف) | `src/data/products.json` + الصور فـ `public/products/` |
| أسعار التوصيل لكل ولاية | `src/lib/wilayas.ts` |
| الأقسام | `src/lib/catalog.ts` |
| اسم المتجر، الواتساب | `src/lib/config.ts` و `.env.local` |
| الأسئلة المتكررة | `src/app/page.tsx` |
| سياسة التوصيل والإرجاع | `src/app/policies/[slug]/page.tsx` |

## الطلبيات
- بلا Supabase: تتحفظ فـ `data/orders.local.json` (للتجربة برك).
- مع Supabase: نفّذ `supabase/schema.sql` وعمّر `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY`.

## منتجات مخبيين (active: false)
- `video-intercom` — السعر كان 0 دج، حط السعر الصحيح وبدّل `active` لـ `true`.
- `dual-lens-wifi-camera-2` — نسخة مكررة.
- `iphone-copy` — ما يناسبش متجر كاميرات + خطر قانوني.
