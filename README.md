# Hồ Sơ BĐS

Ứng dụng quản lý hồ sơ pháp lý bất động sản cho Công ty TNHH Xây Dựng & Địa Ốc Trường Phát, thương hiệu Nguyễn Khoa BĐS.

## Công nghệ

- Next.js App Router, React, TypeScript strict.
- Tailwind CSS và hệ component nội bộ tương đương shadcn/ui.
- Lucide Icons, React Hook Form, Zod, Recharts.
- Demo data layer tách riêng trong `services`.
- Supabase PostgreSQL/Auth/Storage/RLS đã chuẩn bị migration.
- Vitest, Testing Library và Playwright.
- PWA manifest và service worker cơ bản.

## Cài đặt

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Tài khoản demo

Mật khẩu demo: `demo123`

- `admin@hosobds.local`
- `manager@hosobds.local`
- `staff@hosobds.local`
- `accountant@hosobds.local`

Không dùng mật khẩu demo cho production.

## Chế độ demo

Khi chưa có Supabase credentials, app vẫn chạy bằng dữ liệu mẫu trong `services/demo-data.ts`. Dữ liệu demo là giả lập, không chứa CCCD, số điện thoại thật hoặc giấy chứng nhận thật. Các thao tác tạo hồ sơ, thêm lần nộp, bàn giao bản chính và thu chi được lưu vào `localStorage`.

## Cấu hình Supabase

Sao chép `.env.example` thành `.env.local` và điền:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_POLL_SECRET=
TELEGRAM_POLL_INTERVAL_MS=2500
```

Chạy migration trong `supabase/migrations/001_initial_schema.sql`, bật Auth email/password, tạo bucket Storage riêng cho tài liệu và không đưa service role key lên trình duyệt.

## Chức năng đã hoàn thành

- Đăng nhập demo theo vai trò.
- Dashboard số liệu, công nợ, biểu đồ tiến độ và hiệu suất nhân viên.
- Danh sách hồ sơ có tìm kiếm, lọc và sắp xếp theo hạn.
- Tạo hồ sơ theo từng bước, mã `HS-YYYY-XXXX` tự sinh.
- Chi tiết hồ sơ với tab thông tin, lần nộp, tài liệu, công việc, thu chi và lịch sử.
- Chụp/chọn biên nhận, nén ảnh, OCR mock và form xác nhận trước khi lưu.
- Công việc và lịch tuần/tháng.
- Cảnh báo trong ứng dụng.
- Quản lý tài liệu bản chính bằng phiếu bàn giao.
- Thu chi, công nợ và báo cáo.
- Migration Supabase có bảng, index và RLS nền tảng.

## Triển khai

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run start
```

Để deploy lên Google Cloud Run, xem `docs/CLOUD_RUN.md`. Trước production cần cấu hình Supabase thật, chính sách Storage, backup, domain, HTTPS và thay tài khoản demo bằng người dùng thật.

## Hạn chế phiên bản đầu

- OCR là mock provider, chưa gọi dịch vụ AI thật.
- Thông báo email/Zalo mới có cấu trúc cảnh báo, chưa gửi thật.
- Upload tài liệu ở demo mode chỉ tạo đường dẫn UUID giả lập.
- Phân quyền giao diện đã có, enforcement thật cần Supabase RLS sau khi kết nối dữ liệu production.

## Firebase Shared Backend

- App data va Telegram bot co the chia se chung du lieu qua Firestore.
- Neu chua dien `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` thi app se fallback ve file JSON trong `data/`.
- Seed du lieu local len Firestore:

```bash
npm run firebase:seed
```

- Chay app va bot local:

```bash
npm run dev
npm run telegram:bot
```
