import { getSupabaseClient } from "@/services/supabase-client";
import { demoData } from "@/services/demo-data";
import type { CreateCaseInput, DataRepository } from "@/services/repository";
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export class SupabaseRepository implements DataRepository {
  private data: AppData;

  constructor(initialData: AppData = demoData) {
    this.data = clone(initialData);
    this.fetchInitialData();
  }

  private async fetchInitialData(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const [
        { data: orgs },
        { data: profiles },
        { data: customers },
        { data: properties },
        { data: cases },
        { data: caseProps },
        { data: submissions },
        { data: docs },
        { data: custodyTransfers },
        { data: tasks },
        { data: payments },
        { data: activityLogs },
        { data: notifications }
      ] = await Promise.all([
        supabase.from("organizations").select("*").limit(1),
        supabase.from("profiles").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("properties").select("*"),
        supabase.from("cases").select("*"),
        supabase.from("case_properties").select("*"),
        supabase.from("submissions").select("*"),
        supabase.from("documents").select("*"),
        supabase.from("custody_transfers").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*")
      ]);

      if (orgs && orgs.length > 0) {
        this.data.organization = orgs[0] as AppData["organization"];
      }
      if (profiles) this.data.profiles = profiles as Profile[];
      if (customers) this.data.customers = customers as AppData["customers"];
      if (properties) this.data.properties = properties as AppData["properties"];
      if (cases) this.data.cases = cases as Case[];
      if (caseProps) this.data.caseProperties = caseProps as AppData["caseProperties"];
      if (submissions) this.data.submissions = submissions as Submission[];
      if (docs) this.data.documents = docs as DocumentRecord[];
      if (custodyTransfers) this.data.custodyTransfers = custodyTransfers as CustodyTransfer[];
      if (tasks) this.data.tasks = tasks as CaseTask[];
      if (payments) this.data.payments = payments as Payment[];
      if (activityLogs) this.data.activityLogs = activityLogs as ActivityLog[];
      if (notifications) this.data.notifications = notifications as AppData["notifications"];
    } catch (err) {
      console.warn("Failed to fetch initial Supabase data, falling back to cached state:", err);
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

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("cases").insert({
        id: caseItem.id,
        organization_id: caseItem.organizationId,
        case_code: caseItem.caseCode,
        customer_id: caseItem.customerId,
        title: caseItem.title,
        service_type: caseItem.serviceType,
        status: caseItem.status,
        priority: caseItem.priority,
        assigned_to: caseItem.assignedTo,
        received_date: caseItem.receivedDate,
        internal_due_date: caseItem.internalDueDate,
        promised_date: caseItem.promisedDate,
        service_fee: caseItem.serviceFee,
        estimated_cost: caseItem.estimatedCost,
        description: caseItem.description,
        created_by: caseItem.createdBy
      }).then();
    }

    return clone(caseItem);
  }

  updateCaseStatus(caseId: string, status: CaseStatus, actorId: string): void {
    const caseItem = this.requireCase(caseId);
    const previousValue = caseItem.status;
    caseItem.status = status;
    caseItem.completedAt = status === "Hoàn tất" ? now() : caseItem.completedAt;
    caseItem.updatedAt = now();
    this.addLog(actorId, "Cập nhật trạng thái", "cases", caseId, previousValue, status, caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("cases").update({
        status,
        completed_at: caseItem.completedAt,
        updated_at: caseItem.updatedAt
      }).eq("id", caseId).then();
    }
  }

  updateCaseAssignee(caseId: string, assignedTo: string, actorId: string): void {
    const caseItem = this.requireCase(caseId);
    const previousValue = caseItem.assignedTo;
    caseItem.assignedTo = assignedTo;
    caseItem.updatedAt = now();
    this.addLog(actorId, "Đổi nhân viên phụ trách", "cases", caseId, previousValue, assignedTo, caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("cases").update({
        assigned_to: assignedTo,
        updated_at: caseItem.updatedAt
      }).eq("id", caseId).then();
    }
  }

  addSubmission(input: Omit<Submission, "id" | "createdAt" | "updatedAt">, actorId: string): Submission {
    this.requireCase(input.caseId);
    const submission: Submission = { ...input, id: makeId("sub"), createdAt: now(), updatedAt: now() };
    this.data.submissions.unshift(submission);
    this.addLog(actorId, "Thêm lần nộp", "submissions", submission.id, undefined, submission.submissionCode, input.caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("submissions").insert({
        id: submission.id,
        case_id: submission.caseId,
        submission_code: submission.submissionCode,
        procedure_type: submission.procedureType,
        receiving_agency: submission.receivingAgency,
        submitted_date: submission.submittedDate,
        expected_return_date: submission.expectedReturnDate,
        actual_return_date: submission.actualReturnDate,
        submitted_by: submission.submittedBy,
        applicant_name: submission.applicantName,
        submission_result: submission.submissionResult,
        officer_note: submission.officerNote,
        lookup_url: submission.lookupUrl,
        qr_content: submission.qrContent,
        receipt_image_url: submission.receiptImageUrl,
        status: submission.status
      }).then();
    }

    return clone(submission);
  }

  addTask(input: Omit<CaseTask, "id" | "createdAt">, actorId: string): CaseTask {
    this.requireCase(input.caseId);
    const task: CaseTask = { ...input, id: makeId("task"), createdAt: now() };
    this.data.tasks.unshift(task);
    this.addLog(actorId, "Thêm công việc", "tasks", task.id, undefined, task.title, input.caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("tasks").insert({
        id: task.id,
        case_id: task.caseId,
        title: task.title,
        description: task.description,
        assigned_to: task.assignedTo,
        due_date: task.dueDate,
        due_time: task.dueTime,
        status: task.status,
        priority: task.priority
      }).then();
    }

    return clone(task);
  }

  completeTask(taskId: string, actorId: string): void {
    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Không tìm thấy công việc.");
    task.status = "Hoàn thành";
    task.completedAt = now();
    this.addLog(actorId, "Hoàn thành công việc", "tasks", taskId, undefined, task.title, task.caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("tasks").update({
        status: task.status,
        completed_at: task.completedAt
      }).eq("id", taskId).then();
    }
  }

  addDocument(input: Omit<DocumentRecord, "id" | "createdAt">, actorId: string): DocumentRecord {
    this.requireCase(input.caseId);
    const document: DocumentRecord = { ...input, id: makeId("doc"), createdAt: now() };
    this.data.documents.unshift(document);
    this.addLog(actorId, "Thêm tài liệu", "documents", document.id, undefined, document.documentName, input.caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("documents").insert({
        id: document.id,
        case_id: document.caseId,
        submission_id: document.submissionId,
        document_name: document.documentName,
        document_type: document.documentType,
        original_or_copy: document.originalOrCopy,
        quantity: document.quantity,
        file_url: document.fileUrl,
        confidential: document.confidential,
        current_holder_id: document.currentHolderId,
        storage_location: document.storageLocation,
        received_date: document.receivedDate,
        returned_date: document.returnedDate,
        notes: document.notes
      }).then();
    }

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

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("custody_transfers").insert({
        id: transfer.id,
        document_id: transfer.documentId,
        from_user_id: transfer.fromUserId,
        to_user_id: transfer.toUserId,
        transfer_type: transfer.transferType,
        transferred_at: transfer.transferredAt,
        note: transfer.note,
        confirmation_image_url: transfer.confirmationImageUrl,
        created_by: transfer.createdBy
      }).then();
    }

    return clone(transfer);
  }

  addPayment(input: Omit<Payment, "id">, actorId: string): Payment {
    this.requireCase(input.caseId);
    const payment: Payment = { ...input, id: makeId("pay") };
    this.data.payments.unshift(payment);
    this.addLog(actorId, "Ghi nhận thu chi", "payments", payment.id, undefined, String(payment.amount), input.caseId);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("payments").insert({
        id: payment.id,
        case_id: payment.caseId,
        payment_type: payment.paymentType,
        category: payment.category,
        amount: payment.amount,
        payment_date: payment.paymentDate,
        payment_method: payment.paymentMethod,
        payer: payment.payer,
        receiver: payment.receiver,
        receipt_url: payment.receiptUrl,
        note: payment.note,
        created_by: payment.createdBy
      }).then();
    }

    return clone(payment);
  }

  reset(): void {
    this.data = clone(demoData);
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

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("activity_logs").insert({
        id: log.id,
        organization_id: log.organizationId,
        case_id: log.caseId,
        actor_id: log.actorId,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        previous_value: log.previousValue ? { val: log.previousValue } : null,
        new_value: log.newValue ? { val: log.newValue } : null
      }).then();
    }

    return log;
  }
}
