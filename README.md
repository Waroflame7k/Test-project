# Ho So BDS

Ung dung quan ly ho so bat dong san, bien nhan va cong viec noi bo.

## Nen tang

- Next.js, React, TypeScript va Tailwind CSS.
- Firestore la nguon du lieu dung chung.
- Firebase Cloud Messaging cho thong bao web.
- Telegram bot gui bao cao cong viec den han va ho so sap han luc 08:00 (Asia/Ho_Chi_Minh).
- Vercel la nen tang trien khai production.

## Chay local

```bash
npm install
npm run dev
```

Mo `http://localhost:3000`.

Tai khoan demo dung mat khau `demo123`:

- `admin@hosobds.local`
- `manager@hosobds.local`
- `staff@hosobds.local`
- `accountant@hosobds.local`

## Cau hinh Firebase

Sao chep `.env.example` thanh `.env.local`, sau do dien thong tin Firebase public va Firebase Admin. Khong commit file `.env.local` hay service-account JSON.

```bash
npm run firebase:seed
```

Lenh nay seed du lieu mau len Firestore khi can thiet.

## Telegram

Can cau hinh cac bien production sau tren Vercel:

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
CRON_SECRET=
```

Nguoi dung mo bot va gui `/start` mot lan de nhan thong bao hang ngay.

## Kiem tra

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```
