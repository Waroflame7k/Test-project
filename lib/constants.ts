import type { CaseStatus, PaymentType, ServiceType, UserRole } from "@/types/domain";

export const TIME_ZONE = "Asia/Ho_Chi_Minh";
export const DEMO_PASSWORD = "demo123";

export const SERVICE_TYPES: ServiceType[] = [
  "Sang tên",
  "Tặng cho",
  "Thừa kế",
  "Tách thửa",
  "Hợp thửa",
  "Chuyển mục đích",
  "Cấp đổi",
  "Cấp lại",
  "Đính chính",
  "Trích lục",
  "Đo đạc",
  "Xin phép xây dựng",
  "Hồ sơ bồi thường",
  "Khác"
];

export const CASE_STATUSES: CaseStatus[] = [
  "Mới tiếp nhận",
  "Đang chuẩn bị",
  "Đã nộp",
  "Cần bổ sung",
  "Chờ khách cung cấp",
  "Chờ nộp thuế",
  "Đang giải quyết",
  "Có kết quả",
  "Đã nhận kết quả",
  "Đã bàn giao khách",
  "Hoàn tất",
  "Tạm dừng",
  "Hồ sơ bị trả",
  "Khách hủy",
  "Đang khiếu nại"
];

export const PAYMENT_TYPES: PaymentType[] = ["Thu", "Chi"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Quản trị",
  manager: "Quản lý",
  legal_staff: "Nhân viên pháp lý",
  accountant: "Kế toán",
  viewer: "Chỉ xem"
};

export const DEMO_ACCOUNTS = [
  "admin@hosobds.local",
  "manager@hosobds.local",
  "staff@hosobds.local",
  "accountant@hosobds.local"
];
