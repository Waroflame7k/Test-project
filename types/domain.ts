export type UserRole = "admin" | "manager" | "legal_staff" | "accountant" | "viewer";

export type CaseStatus =
  | "Mới tiếp nhận"
  | "Đang chuẩn bị"
  | "Đã nộp"
  | "Cần bổ sung"
  | "Chờ khách cung cấp"
  | "Chờ nộp thuế"
  | "Đang giải quyết"
  | "Có kết quả"
  | "Đã nhận kết quả"
  | "Đã bàn giao khách"
  | "Hoàn tất"
  | "Tạm dừng"
  | "Hồ sơ bị trả"
  | "Khách hủy"
  | "Đang khiếu nại";

export type ServiceType =
  | "Sang tên"
  | "Tặng cho"
  | "Thừa kế"
  | "Tách thửa"
  | "Hợp thửa"
  | "Chuyển mục đích"
  | "Cấp đổi"
  | "Cấp lại"
  | "Đính chính"
  | "Trích lục"
  | "Xin phép xây dựng"
  | "Hồ sơ bồi thường"
  | "Khác";

export type Priority = "Thấp" | "Trung bình" | "Cao" | "Khẩn";
export type TaskStatus = "Chưa làm" | "Đang làm" | "Hoàn thành";
export type SubmissionStatus = "Đã nộp" | "Cần bổ sung" | "Có kết quả" | "Đã nhận" | "Đã hủy";
export type PaymentType = "Thu" | "Chi";

export interface Organization {
  id: string;
  name: string;
  brandName: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  customerCode: string;
  fullName: string;
  phone: string;
  zalo?: string;
  email?: string;
  address: string;
  referralSource?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface Property {
  id: string;
  organizationId: string;
  propertyCode: string;
  province: string;
  ward: string;
  address: string;
  mapSheetNumber: string;
  parcelNumber: string;
  area: number;
  landType: string;
  certificateNumber: string;
  certificateOwner: string;
  mapUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface Case {
  id: string;
  organizationId: string;
  caseCode: string;
  customerId: string;
  title: string;
  serviceType: ServiceType;
  status: CaseStatus;
  priority: Priority;
  assignedTo: string;
  receivedDate: string;
  internalDueDate: string;
  promisedDate: string;
  serviceFee: number;
  estimatedCost: number;
  description?: string;
  holdReason?: string;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CaseProperty {
  caseId: string;
  propertyId: string;
}

export interface Submission {
  id: string;
  caseId: string;
  submissionCode: string;
  procedureType: string;
  receivingAgency: string;
  submittedDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  submittedBy: string;
  applicantName: string;
  submissionResult?: string;
  officerNote?: string;
  lookupUrl?: string;
  qrContent?: string;
  receiptImageUrl?: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  caseId: string;
  submissionId?: string;
  documentName: string;
  documentType: string;
  originalOrCopy: "Bản chính" | "Bản sao" | "Bản scan";
  quantity: number;
  fileUrl?: string;
  confidential: boolean;
  currentHolderId?: string;
  storageLocation?: string;
  receivedDate?: string;
  returnedDate?: string;
  notes?: string;
  createdAt: string;
}

export interface CustodyTransfer {
  id: string;
  documentId: string;
  fromUserId?: string;
  toUserId: string;
  transferType: "Nhận từ khách" | "Bàn giao nội bộ" | "Mang đi nộp" | "Nhận lại" | "Bàn giao khách";
  transferredAt: string;
  note?: string;
  confirmationImageUrl?: string;
  createdBy: string;
}

export interface CaseTask {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  status: TaskStatus;
  priority: Priority;
  completedAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  caseId: string;
  paymentType: PaymentType;
  category: string;
  amount: number;
  paymentDate: string;
  paymentMethod: "Tiền mặt" | "Chuyển khoản" | "Khác";
  // Old records can retain these values; new transactions do not require them.
  payer?: string;
  receiver?: string;
  receiptUrl?: string;
  note?: string;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  organizationId: string;
  caseId?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  caseId?: string;
  title: string;
  message: string;
  notificationType: string;
  readAt?: string;
  createdAt: string;
}

export interface AppData {
  organization: Organization;
  profiles: Profile[];
  customers: Customer[];
  properties: Property[];
  cases: Case[];
  caseProperties: CaseProperty[];
  submissions: Submission[];
  documents: DocumentRecord[];
  custodyTransfers: CustodyTransfer[];
  tasks: CaseTask[];
  payments: Payment[];
  activityLogs: ActivityLog[];
  notifications: NotificationRecord[];
}

export interface CaseBundle {
  caseItem: Case;
  customer: Customer;
  properties: Property[];
  assignedProfile?: Profile;
  submissions: Submission[];
  documents: DocumentRecord[];
  tasks: CaseTask[];
  payments: Payment[];
  activityLogs: ActivityLog[];
}
