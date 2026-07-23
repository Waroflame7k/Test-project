import { demoData } from "@/services/demo-data";
import type {
  ActivityLog,
  AppData,
  Case,
  CaseBundle,
  CaseStatus,
  CaseTask,
  CustodyTransfer,
  DocumentRecord,
  Payment,
  Profile,
  Submission
} from "@/types/domain";
import { generateCaseCode } from "@/lib/case-utils";

const STORAGE_KEY = "ho-so-bds-demo-data";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export interface CreateCaseInput {
  customerId: string;
  propertyIds: string[];
  title: string;
  serviceType: Case["serviceType"];
  serviceFee: number;
  estimatedCost: number;
  assignedTo: string;
  receivedDate: string;
  internalDueDate: string;
  promisedDate: string;
  description?: string;
  createdBy: string;
}

export interface DataRepository {
  getData(): AppData;
  getProfileByEmail(email: string): Profile | undefined;
  getCaseBundle(caseId: string): CaseBundle | undefined;
  createCase(input: CreateCaseInput): Case;
  updateCaseStatus(caseId: string, status: CaseStatus, actorId: string): void;
  updateCaseAssignee(caseId: string, assignedTo: string, actorId: string): void;
  addSubmission(input: Omit<Submission, "id" | "createdAt" | "updatedAt">, actorId: string): Submission;
  addTask(input: Omit<CaseTask, "id" | "createdAt">, actorId: string): CaseTask;
  completeTask(taskId: string, actorId: string): void;
  addDocument(input: Omit<DocumentRecord, "id" | "createdAt">, actorId: string): DocumentRecord;
  transferDocument(input: Omit<CustodyTransfer, "id">): CustodyTransfer;
  addPayment(input: Omit<Payment, "id">, actorId: string): Payment;
  reset(): void;
}

export class DemoRepository implements DataRepository {
  private data: AppData;
  private persist: boolean;

  constructor(initialData: AppData = demoData, persist = false) {
    this.persist = persist;
    this.data = clone(initialData);
    if (persist && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) this.data = JSON.parse(stored) as AppData;
    }
  }

  getData(): AppData {
    return clone(this.data);
  }

  getProfileByEmail(email: string): Profile | undefined {
    return this.data.profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase() && profile.active);
  }

  getCaseBundle(caseId: string): CaseBundle | undefined {
    const caseItem = this.data.cases.find((item) => item.id === caseId && !item.archivedAt);
    if (!caseItem) return undefined;
    const customer = this.data.customers.find((item) => item.id === caseItem.customerId);
    if (!customer) return undefined;
    const propertyIds = this.data.caseProperties.filter((item) => item.caseId === caseId).map((item) => item.propertyId);
    return {
      caseItem,
      customer,
      properties: this.data.properties.filter((property) => propertyIds.includes(property.id)),
      assignedProfile: this.data.profiles.find((profile) => profile.id === caseItem.assignedTo),
      submissions: this.data.submissions.filter((submission) => submission.caseId === caseId),
      documents: this.data.documents.filter((document) => document.caseId === caseId),
      tasks: this.data.tasks.filter((task) => task.caseId === caseId),
      payments: this.data.payments.filter((payment) => payment.caseId === caseId),
      activityLogs: this.data.activityLogs.filter((log) => log.caseId === caseId)
    };
  }

  createCase(input: CreateCaseInput): Case {
    const year = Number(input.receivedDate.slice(0, 4));
    const caseItem: Case = {
      id: makeId("case"),
      organizationId: this.data.organization.id,
      caseCode: generateCaseCode(year, this.data.cases.map((item) => item.caseCode)),
      customerId: input.customerId,
      title: input.title,
      serviceType: input.serviceType,
      status: "Mới tiếp nhận",
      priority: "Trung bình",
      assignedTo: input.assignedTo,
      receivedDate: input.receivedDate,
      internalDueDate: input.internalDueDate,
      promisedDate: input.promisedDate,
      serviceFee: input.serviceFee,
      estimatedCost: input.estimatedCost,
      description: input.description,
      createdBy: input.createdBy,
      createdAt: now(),
      updatedAt: now()
    };
    this.data.cases.unshift(caseItem);
    input.propertyIds.forEach((propertyId) => this.data.caseProperties.push({ caseId: caseItem.id, propertyId }));
    this.addLog(input.createdBy, "Tạo hồ sơ", "cases", caseItem.id, undefined, caseItem.caseCode, caseItem.id);
    this.save();
    return clone(caseItem);
  }

  updateCaseStatus(caseId: string, status: CaseStatus, actorId: string): void {
    const caseItem = this.requireCase(caseId);
    const previousValue = caseItem.status;
    caseItem.status = status;
    caseItem.completedAt = status === "Hoàn tất" ? now() : caseItem.completedAt;
    caseItem.updatedAt = now();
    this.addLog(actorId, "Cập nhật trạng thái", "cases", caseId, previousValue, status, caseId);
    this.save();
  }

  updateCaseAssignee(caseId: string, assignedTo: string, actorId: string): void {
    const caseItem = this.requireCase(caseId);
    const previousValue = caseItem.assignedTo;
    caseItem.assignedTo = assignedTo;
    caseItem.updatedAt = now();
    this.addLog(actorId, "Đổi nhân viên phụ trách", "cases", caseId, previousValue, assignedTo, caseId);
    this.save();
  }

  addSubmission(input: Omit<Submission, "id" | "createdAt" | "updatedAt">, actorId: string): Submission {
    this.requireCase(input.caseId);
    const submission: Submission = { ...input, id: makeId("sub"), createdAt: now(), updatedAt: now() };
    this.data.submissions.unshift(submission);
    this.addLog(actorId, "Thêm lần nộp", "submissions", submission.id, undefined, submission.submissionCode, input.caseId);
    this.save();
    return clone(submission);
  }

  addTask(input: Omit<CaseTask, "id" | "createdAt">, actorId: string): CaseTask {
    this.requireCase(input.caseId);
    const task: CaseTask = { ...input, id: makeId("task"), createdAt: now() };
    this.data.tasks.unshift(task);
    this.addLog(actorId, "Thêm công việc", "tasks", task.id, undefined, task.title, input.caseId);
    this.save();
    return clone(task);
  }

  completeTask(taskId: string, actorId: string): void {
    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Không tìm thấy công việc.");
    task.status = "Hoàn thành";
    task.completedAt = now();
    this.addLog(actorId, "Hoàn thành công việc", "tasks", taskId, undefined, task.title, task.caseId);
    this.save();
  }

  addDocument(input: Omit<DocumentRecord, "id" | "createdAt">, actorId: string): DocumentRecord {
    this.requireCase(input.caseId);
    const document: DocumentRecord = { ...input, id: makeId("doc"), createdAt: now() };
    this.data.documents.unshift(document);
    this.addLog(actorId, "Thêm tài liệu", "documents", document.id, undefined, document.documentName, input.caseId);
    this.save();
    return clone(document);
  }

  transferDocument(input: Omit<CustodyTransfer, "id">): CustodyTransfer {
    const document = this.data.documents.find((item) => item.id === input.documentId);
    if (!document) throw new Error("Không tìm thấy tài liệu.");
    const previousValue = document.currentHolderId;
    const transfer: CustodyTransfer = { ...input, id: makeId("ct") };
    document.currentHolderId = input.toUserId;
    if (input.transferType === "Bàn giao khách") document.returnedDate = input.transferredAt.slice(0, 10);
    this.data.custodyTransfers.unshift(transfer);
    this.addLog(
      input.createdBy,
      "Bàn giao tài liệu bản chính",
      "custody_transfers",
      transfer.id,
      previousValue,
      input.toUserId,
      document.caseId
    );
    this.save();
    return clone(transfer);
  }

  addPayment(input: Omit<Payment, "id">, actorId: string): Payment {
    this.requireCase(input.caseId);
    const payment: Payment = { ...input, id: makeId("pay") };
    this.data.payments.unshift(payment);
    this.addLog(actorId, "Ghi nhận thu chi", "payments", payment.id, undefined, String(payment.amount), input.caseId);
    this.save();
    return clone(payment);
  }

  reset(): void {
    this.data = clone(demoData);
    this.save();
  }

  private requireCase(caseId: string): Case {
    const caseItem = this.data.cases.find((item) => item.id === caseId && !item.archivedAt);
    if (!caseItem) throw new Error("Không tìm thấy hồ sơ.");
    return caseItem;
  }

  private addLog(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    previousValue?: string,
    newValue?: string,
    caseId?: string
  ): ActivityLog {
    const log: ActivityLog = {
      id: makeId("log"),
      organizationId: this.data.organization.id,
      caseId,
      actorId,
      action,
      entityType,
      entityId,
      previousValue,
      newValue,
      createdAt: now()
    };
    this.data.activityLogs.unshift(log);
    return log;
  }

  private save(): void {
    if (this.persist && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }
  }
}

export function createRepository(): DataRepository {
  return new DemoRepository(undefined, true);
}

