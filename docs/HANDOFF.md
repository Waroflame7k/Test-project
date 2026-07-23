# Bàn giao dự án Hồ Sơ BĐS

## Thông tin nhanh

- Tên app: Hồ Sơ BĐS
- Công ty: Công ty TNHH Xây Dựng & Địa Ốc Trường Phát
- Thương hiệu: Nguyễn Khoa BĐS
- Ngôn ngữ giao diện: tiếng Việt
- Timezone: Asia/Ho_Chi_Minh
- Tiền tệ: VNĐ
- Cloud Run URL hiện tại: https://ho-so-bds-143843075184.asia-southeast1.run.app

## Tài khoản demo

Mật khẩu demo: `demo123`

- `admin@hosobds.local`
- `manager@hosobds.local`
- `staff@hosobds.local`
- `accountant@hosobds.local`

Không dùng mật khẩu demo cho production.

## Công nghệ

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- Lucide Icons
- React Hook Form
- Zod
- Recharts
- Vitest
- Playwright
- Docker + Google Cloud Run
- Supabase migration đã chuẩn bị, demo mode đang chạy bằng dữ liệu mẫu/localStorage

## Cách chạy local

```bash
npm install
npm run dev
```

Mở:

```text
http://localhost:3000
```

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Nếu muốn chạy e2e:

```bash
npm run test:e2e
```

## Deploy Cloud Run

Project Google Cloud đang dùng:

```text
project-91855cb7-78fb-4e44-b93
```

Region:

```text
asia-southeast1
```

Deploy lại:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_REGION=asia-southeast1,_SERVICE=ho-so-bds,_REPOSITORY=ho-so-bds
```

Xem hướng dẫn chi tiết ở `docs/CLOUD_RUN.md`.

## Cấu trúc quan trọng

- `app/`: Next.js App Router.
- `features/`: màn hình chính và luồng nghiệp vụ.
- `components/`: component UI dùng chung.
- `lib/`: tiện ích ngày, tiền, quyền, cảnh báo, upload.
- `services/`: demo data layer, repository, OCR provider.
- `types/`: model domain.
- `supabase/migrations/`: schema PostgreSQL/RLS.
- `docs/`: tài liệu database, workflow, deployment, Cloud Run, next steps.
- `tests/`: unit test và e2e test.
- `design-references/`: ảnh tham khảo giao diện ban đầu.

## Việc nên làm tiếp

1. Kết nối Supabase thật thay cho demo localStorage.
2. Tạo người dùng thật và bỏ tài khoản demo.
3. Thiết lập Supabase Storage cho biên nhận/tài liệu.
4. Kiểm thử RLS theo từng vai trò.
5. Gắn domain riêng cho Cloud Run.
6. Bật budget alert trên Google Cloud.
7. Tích hợp OCR thật, Zalo/email notification, xuất PDF bàn giao.

## Lưu ý bảo mật

- Không commit `.env`, secret key, service role key.
- Không đưa CCCD, số điện thoại thật hoặc giấy chứng nhận thật vào demo data.
- File upload phải dùng UUID path, không dùng tên khách hàng.
- Production cần backup database và audit log đầy đủ.
