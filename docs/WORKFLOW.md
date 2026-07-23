# Workflow

## Tiếp nhận đến hoàn tất

1. Tạo hoặc chọn khách hàng.
2. Tạo hoặc chọn bất động sản.
3. Tạo hồ sơ với loại dịch vụ, phí, nhân viên phụ trách, ngày nhận, hạn nội bộ và ngày cam kết.
4. Chuẩn bị tài liệu, phân công công việc.
5. Nộp hồ sơ và ghi nhận từng lần nộp bằng mã biên nhận riêng.
6. Theo dõi cảnh báo, bổ sung, thuế, kết quả và bàn giao.
7. Ghi nhận thu chi, đối soát còn phải thu.
8. Hoàn tất hồ sơ và giữ audit log.

## Nộp hồ sơ

- Mỗi lần nộp tạo một record `submissions`.
- Một vụ việc có thể có nhiều lần nộp, ví dụ tách thửa rồi đăng ký biến động/tặng cho.
- Biên nhận có thể nhập tay hoặc qua luồng OCR mock, nhưng chỉ lưu sau khi người dùng xác nhận.

## Bổ sung

- Khi trạng thái là `Cần bổ sung`, hệ thống tạo cảnh báo nếu quá 2 ngày chưa xử lý.
- Ghi chú bổ sung lưu ở `hold_reason` hoặc `officer_note`.

## Bàn giao bản chính

- Không sửa trực tiếp `documents.current_holder_id`.
- Tạo phiếu trong `custody_transfers`, sau đó hệ thống cập nhật người giữ.
- Phiếu cần người giao, người nhận, thời điểm, loại bàn giao và ghi chú.

## Thu phí

- Phí dịch vụ nằm ở `cases.service_fee`.
- Các khoản khách thanh toán là `payments.payment_type = Thu`.
- Còn phải thu = phí dịch vụ - tổng đã thu.
- Chi phí phát sinh cho hồ sơ được ghi bằng `Chi` và tự cộng vào số tiền khách còn phải thanh toán.
