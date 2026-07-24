# Hướng dẫn sử dụng Hồ Sơ BĐS

## 1. Đăng nhập và phân quyền

Mở app tại địa chỉ đã triển khai hoặc `http://localhost:3000` khi chạy local.

- Tài khoản demo dùng chung mật khẩu `demo123`.
- `admin@hosobds.local`: quản trị toàn bộ dữ liệu và người dùng.
- `manager@hosobds.local`: theo dõi, phân công, thêm tài liệu và thu chi.
- `staff@hosobds.local`: xử lý hồ sơ, biên nhận, tài liệu và công việc được giao.
- `accountant@hosobds.local`: xem và ghi nhận thu chi.

## 2. Quy trình làm việc đề xuất

1. Tạo **hồ sơ khách hàng** trước: nhập khách hàng, bất động sản, loại dịch vụ, phí dịch vụ và người phụ trách.
2. Vào hồ sơ vừa tạo, mở tab **Lần nộp** để thêm biên nhận thủ công hoặc quét OCR.
3. Kiểm tra lại dữ liệu OCR trước khi lưu; chỉ lưu khi đã chọn đúng hồ sơ khách hàng.
4. Thêm tài liệu, công việc và thu chi ngay trong các tab của hồ sơ.
5. Cập nhật trạng thái hồ sơ và bàn giao bản chính khi hoàn tất.

## 3. Tạo và theo dõi hồ sơ

- Vào **Hồ sơ** và chọn **Tạo hồ sơ khách hàng**.
- Nhập thông tin khách hàng, thông tin công việc/dịch vụ và mốc hẹn trả.
- Danh sách hồ sơ có các nhóm **Tất cả**, **Hồ sơ mới** và **Sắp hạn**; dùng bộ lọc và sắp xếp để tìm nhanh.
- Bấm một hồ sơ để xem các tab: **Thông tin**, **Lần nộp**, **Tài liệu**, **Công việc**, **Thu chi** và **Lịch sử**.
- Xóa hồ sơ hoặc dữ liệu con luôn cần xác nhận. Tab Lịch sử không xóa để giữ dấu vết quản lý.

## 4. Quét biên nhận OCR

1. Mở hồ sơ, chọn tab **Lần nộp**, rồi bấm **Quét biên nhận**.
2. Chụp hoặc chọn ảnh biên nhận rõ nét, đủ bốn góc và không bị lóa.
3. OCR gợi ý mã biên nhận, loại thủ tục, cơ quan tiếp nhận, ngày nộp, ngày hẹn trả và người liên quan.
4. Kiểm tra từng trường. Mã biên nhận chỉ giữ phần trước dấu `/` để tránh hậu tố không cần thiết.
5. Chọn đúng **Hồ sơ khách hàng** và lưu.

Ảnh biên nhận được lưu cùng lần nộp, xem lại tại phần đầu tab **Lần nộp** của chính hồ sơ đó.

## 5. Quản lý tài liệu

- Trong tab **Tài liệu**, bấm **Thêm tài liệu** để ghi nhận tên, loại, bản chính/bản sao/bản scan, số lượng, người giữ và vị trí lưu.
- Dùng **Bàn giao** khi đổi người giữ hoặc trả bản chính cho khách.
- Dùng **Sửa** để cập nhật thông tin tài liệu.
- Dùng **Xóa** khi tài liệu nhập nhầm. Lịch sử bàn giao liên quan cũng được xóa để không còn dữ liệu mồ côi.
- Mục **Quản lý tài liệu** ở menu giúp xem tổng hợp tài liệu của mọi hồ sơ được phép truy cập.

## 6. Công việc

- Vào **Công việc** và bấm **Thêm công việc**, hoặc thêm ngay trong tab Công việc của một hồ sơ.
- Khi tạo từ màn hình Công việc, danh sách hồ sơ hiển thị theo dạng `Tên khách hàng - loại dịch vụ (mã hồ sơ)` để dễ tìm.
- Chọn người phụ trách, hạn, giờ và mức ưu tiên.
- Bấm vào một công việc để mở hồ sơ liên quan; đánh dấu tròn để hoàn thành.

## 7. Thu chi

- Vào tab **Thu chi** trong hồ sơ để ghi nhận trực tiếp giao dịch liên quan.
- Với giao dịch **Thu**, có thể chọn nhanh **Phí dịch vụ hồ sơ** để điền sẵn số tiền từ hồ sơ.
- Các giao dịch ở trong hồ sơ và menu **Thu chi** là cùng một dữ liệu, nên sửa/xóa ở một nơi sẽ cập nhật nơi còn lại.
- Phần còn phải thu được tính từ phí dịch vụ trừ các khoản đã thu của khách.

## 8. Telegram: thông báo công việc và báo cáo hằng ngày

Bot gửi:

- Thông báo ngay khi có công việc mới: tên việc, khách hàng/hồ sơ, người phụ trách, hạn và ưu tiên.
- Báo cáo lúc 08:00 mỗi ngày: công việc đến hạn hôm nay và hồ sơ sắp/quá hạn.

### Cấu hình bắt buộc

Khai báo các biến sau ở `.env.local` khi chạy local và trong **Vercel Environment Variables** khi chạy production:

```text
TELEGRAM_BOT_TOKEN=<token do BotFather cấp>
TELEGRAM_WEBHOOK_SECRET=<chuỗi bí mật ngẫu nhiên>
CRON_SECRET=<chuỗi bí mật ngẫu nhiên>
```

Webhook chỉ hoạt động trên URL public HTTPS, ví dụ:

```text
https://ten-app.vercel.app/api/telegram/webhook
```

Không dùng `http://localhost:3000` làm webhook vì Telegram không thể gọi vào máy local. Sau khi cấu hình webhook, mỗi người cần mở bot và gửi `/start` một lần để đăng ký nhận thông báo.

### Kiểm tra nhanh

1. Mở bot Telegram và gửi `/start`.
2. Tạo một công việc mới trong app.
3. Tin nhắn phải đến trong vài giây. Nếu không có, kiểm tra token, webhook URL public, `TELEGRAM_WEBHOOK_SECRET` và trạng thái tắt tiếng của chat/bot trên điện thoại.

## 9. Kiểm tra kỹ thuật

Chạy trước khi deploy:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Không commit `.env.local`, token Telegram, Gemini API key hay khóa Firebase Admin.
