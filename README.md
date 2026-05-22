# سحاب - نظام إدارة المعارض والفعاليات

نظام إدارة داخلي لشركة **سحاب** المتخصصة في تنظيم المعارض والفعاليات.

---

## المتطلبات

- Node.js 18+
- npm 9+

---

## الإعداد والتشغيل

### 1. تثبيت الحزم

```bash
npm install
```

### 2. إعداد قاعدة البيانات

```bash
npx prisma db push
```

### 3. إدخال البيانات التجريبية

```bash
npx tsx prisma/seed.ts
```

### 4. تشغيل الخادم

```bash
npm run dev
```

افتح المتصفح على: **http://localhost:3000**

---

## بيانات الدخول التجريبية

| الدور | البريد الإلكتروني | كلمة المرور |
|-------|-----------------|-------------|
| مدير النظام | admin@sahab.ae | Admin@123 |
| مسؤول العمليات | ops@sahab.ae | Ops@123 |

---

## الأوامر المتاحة

| الأمر | الوصف |
|-------|-------|
| `npm run dev` | تشغيل الخادم في وضع التطوير |
| `npm run build` | بناء التطبيق للإنتاج |
| `npm run start` | تشغيل الخادم في وضع الإنتاج |
| `npm run db:push` | تطبيق مخطط قاعدة البيانات |
| `npm run db:seed` | إدخال البيانات التجريبية |
| `npm run db:studio` | فتح Prisma Studio لإدارة البيانات |

---

## إعداد Zoho Books

لمزامنة البيانات من Zoho Books، يجب تعبئة المتغيرات التالية في ملف `.env.local`:

```env
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXX
ZOHO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
ZOHO_ORGANIZATION_ID=123456789
ZOHO_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxx
ZOHO_REDIRECT_URI=http://localhost:3000/api/zoho/callback
```

### خطوات الحصول على بيانات Zoho:

1. أنشئ تطبيقاً في [Zoho API Console](https://api-console.zoho.com/)
2. اختر "Server-based Applications"
3. أضف `http://localhost:3000/api/zoho/callback` كـ Redirect URI
4. احصل على `Client ID` و `Client Secret`
5. اذهب إلى `/api/zoho/auth` للحصول على `Refresh Token`

---

## هيكل قاعدة البيانات

- **User** - المستخدمون والصلاحيات
- **Project** - المشاريع والفعاليات
- **Supplier** - الموردون ومزودو الخدمات
- **Bill** - الفواتير والمدفوعات
- **ProjectIssue** - سجل المشاكل
- **SupplierEvaluation** - تقييمات الموردين
- **ZohoSyncLog** - سجل المزامنة
- **Setting** - إعدادات النظام

---

## الصفحات والميزات

| الصفحة | الوصف |
|--------|-------|
| `/dashboard` | لوحة التحكم الرئيسية مع مؤشرات الأداء |
| `/dashboard/projects` | قائمة المشاريع مع حساب الربحية |
| `/dashboard/suppliers` | إدارة الموردين |
| `/dashboard/bills` | الفواتير مع إمكانية الربط بالمشاريع |
| `/dashboard/issues` | سجل المشاكل |
| `/dashboard/evaluations` | تقييمات الموردين |
| `/dashboard/comparison` | مقارنة الموردين |
| `/dashboard/reports` | التقارير التفصيلية |
| `/dashboard/settings` | إعدادات النظام وـ Zoho |

---

## منطق توصية الموردين

يحسب النظام تلقائياً توصية لكل مورد بناءً على:

- **التقييمات**: ممتاز (3 نقاط)، جيد (2)، ضعيف (1)
- **رغبة عدم التكرار**: خصم 0.5 لكل حالة
- **عدد المشاكل**: خصم 0.5 (أكثر من 3)، خصم 1 (أكثر من 5)

| النتيجة | التوصية |
|---------|---------|
| ≥ 2.5 ومشاكل ≤ 2 | رئيسي (PRIMARY) |
| ≥ 2 ومشاكل ≤ 3 | احتياطي (BACKUP) |
| ≥ 1.5 أو مشاكل ≤ 5 | قيد المراجعة (UNDER_REVIEW) |
| أقل من ذلك | موقوف (SUSPENDED) |
