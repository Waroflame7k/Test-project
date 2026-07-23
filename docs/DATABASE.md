# Database

## Mô hình quan hệ

- `organizations`: công ty hoặc chi nhánh sở hữu dữ liệu.
- `profiles`: người dùng thuộc tổ chức, gắn vai trò `admin`, `manager`, `legal_staff`, `accountant`, `viewer`.
- `customers`: khách hàng. Một khách hàng có nhiều `cases`.
- `properties`: bất động sản. Một vụ việc có thể gắn nhiều bất động sản qua `case_properties`.
- `cases`: vụ việc/hồ sơ chính, chứa trạng thái, loại dịch vụ, hạn, phí và người phụ trách.
- `submissions`: mỗi lần nộp hồ sơ, có mã biên nhận riêng.
- `documents`: tài liệu thuộc hồ sơ hoặc lần nộp. Tài liệu bản chính có `current_holder_id`.
- `custody_transfers`: phiếu bàn giao tài liệu, là nguồn thay đổi người giữ bản chính.
- `tasks`: công việc theo hồ sơ.
- `payments`: thu, chi, chi hộ. Số tiền lưu bằng `bigint` VNĐ.
- `activity_logs`: nhật ký audit cho thay đổi quan trọng.
- `notifications`: cảnh báo và thông báo trong ứng dụng.

## Trường quan trọng

- `cases.archived_at`: xóa mềm, không xóa vĩnh viễn trực tiếp.
- `documents.confidential`: giới hạn quyền xem tài liệu nhạy cảm.
- `payments.amount`: số nguyên VNĐ, không dùng số thực dấu phẩy.
- `activity_logs.previous_value/new_value`: lưu thay đổi trước/sau để truy vết.
- `submissions.receipt_image_url`: đường dẫn ảnh biên nhận trong Storage.

## Index

Migration đã tạo index cho trạng thái hồ sơ, người phụ trách/hạn, tìm khách hàng, child records theo `case_id`, công việc theo hạn, thanh toán và log theo thời gian.

## RLS

RLS bật trên toàn bộ bảng. Chính sách chính:

- Người dùng chỉ đọc dữ liệu cùng `organization_id`.
- Admin/manager xem toàn bộ hồ sơ; legal staff xem và cập nhật hồ sơ được phép thao tác; accountant xem tài chính; viewer chỉ xem dữ liệu cho phép.
- Tài liệu `confidential` chỉ mở cho admin, manager và legal staff.
- Payments chỉ cho admin/accountant ghi, manager/accountant/admin đọc.
- Notifications chỉ người nhận đọc.

Khi đưa vào production, cần bổ sung policy insert/update chi tiết theo workflow và kiểm thử bằng tài khoản thật.
