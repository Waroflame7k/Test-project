# Deployment

## Biến môi trường

- `NEXT_PUBLIC_APP_MODE`: `demo` hoặc `production`.
- `NEXT_PUBLIC_SUPABASE_URL`: URL Supabase project.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key.
- `NEXT_PUBLIC_SITE_URL`: URL production để cấu hình metadata và callback.

Không đưa service role key vào frontend hoặc repository.

## Supabase

1. Tạo Supabase project.
2. Chạy `supabase/migrations/001_initial_schema.sql`.
3. Bật email/password Auth.
4. Tạo users tương ứng trong Auth rồi insert `profiles`.
5. Tạo Storage bucket cho tài liệu, receipt và confirmation image.
6. Áp dụng policy Storage: tài liệu bảo mật chỉ người đủ quyền đọc.
7. Kiểm thử RLS bằng từng role.

## Build

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Google Cloud Run

App đã có `Dockerfile`, `.dockerignore` và `cloudbuild.yaml` để deploy lên Cloud Run. Xem hướng dẫn chi tiết trong `docs/CLOUD_RUN.md`.

## Checklist bảo mật

- Không còn tài khoản/mật khẩu demo.
- RLS bật trên tất cả bảng.
- Storage dùng UUID path, không dùng tên khách hàng trong tên file.
- Giới hạn MIME và dung lượng upload.
- Backup database định kỳ.
- Audit log bật cho thay đổi trạng thái, tài chính, tài liệu bản chính.
- HTTPS, domain, callback URL Auth đã cấu hình.
- Quy trình xóa mềm thay vì xóa cứng.
