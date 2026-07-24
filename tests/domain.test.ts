import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/alerts";
import { generateCaseCode, receivableForCase } from "@/lib/case-utils";
import { daysUntil, formatDate, isDueSoon, isOverdue } from "@/lib/date";
import { calculateReceivable } from "@/lib/money";
import { can } from "@/lib/permissions";
import { currentMonthRange, financeSummary } from "@/lib/reporting";
import { demoData } from "@/services/demo-data";
import { DemoRepository } from "@/services/repository";
import { matchCustomerByName, normalizeProcedureType, normalizeSubmissionCode } from "@/services/ocr";
import { applyAppDataMutation, buildAppDataMutation } from "@/lib/app-data-mutation";

describe("nghiệp vụ hồ sơ BĐS", () => {
  it("chuẩn hóa kết quả OCR theo danh mục và giữ phần mã biên nhận hợp lệ", () => {
    expect(normalizeProcedureType("Trích đo bản đồ địa chính")).toBe("Đo đạc");
    expect(normalizeProcedureType("Thủ tục chuyển nhượng quyền sử dụng đất")).toBe("Sang tên");
    expect(normalizeProcedureType("Nội dung không xác định")).toBe("");
    expect(normalizeSubmissionCode("2047/ĐĐKT_2026/TNHS")).toBe("2047/ĐĐKT_2026");
    expect(normalizeSubmissionCode("H53.183-260626-0130/TNHS")).toBe("H53.183-260626-0130");
  });

  it("đối chiếu tên OCR không dấu với khách hàng hiện có", () => {
    const customer = demoData.customers[0];
    const match = matchCustomerByName(
      customer.fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      demoData.customers,
      demoData.profiles
    );
    expect(match?.customerId).toBe(customer.id);
    expect(match?.confidence).toBe(100);
  });

  it("đồng bộ mutation giữ bản ghi sửa và xóa thật bản ghi đã bỏ", () => {
    const current = structuredClone(demoData);
    const removedPaymentId = current.payments[0].id;
    const next = {
      ...current,
      payments: current.payments.slice(1),
      tasks: current.tasks.map((task, index) => (index === 0 ? { ...task, title: "Công việc đã sửa" } : task)),
    };
    const mutation = buildAppDataMutation(current, next);
    const applied = applyAppDataMutation(current, mutation);

    expect(mutation.collections.payments?.deleteIds).toContain(removedPaymentId);
    expect(applied.payments.some((payment) => payment.id === removedPaymentId)).toBe(false);
    expect(applied.tasks[0].title).toBe("Công việc đã sửa");
  });
  it("sinh mã hồ sơ HS-YYYY-XXXX kế tiếp", () => {
    expect(generateCaseCode(2026, ["HS-2026-0001", "HS-2026-0012", "HS-2025-0099"])).toBe("HS-2026-0013");
  });

  it("tính số ngày còn lại, sắp đến hạn và quá hạn", () => {
    expect(daysUntil("2026-07-23", "2026-07-21")).toBe(2);
    expect(isDueSoon("2026-07-23", "2026-07-21", 5)).toBe(true);
    expect(isOverdue("2026-07-20", "2026-07-21")).toBe(true);
  });

  it("hiển thị được ngày ISO có cả giờ và không làm lỗi dữ liệu ngày hỏng", () => {
    expect(formatDate("2026-06-24T09:10:00+07:00")).toBe("24/06/2026");
    expect(formatDate("không phải ngày")).toBe("-");
  });

  it("cộng chi phí đã chi vào số tiền khách còn phải thanh toán", () => {
    expect(calculateReceivable(18_000_000, 8_000_000)).toBe(10_000_000);
    expect(receivableForCase(demoData.cases[0], demoData.payments)).toBe(12_500_000);
  });

  it("tổng hợp thu chi theo cùng logic cho tổng quan và báo cáo", () => {
    const summary = financeSummary(demoData.payments);
    expect(summary.received).toBeGreaterThan(0);
    expect(summary.spent).toBeGreaterThan(0);
    expect(summary.netCashflow).toBe(summary.received - summary.spent);
    expect(currentMonthRange("2026-02-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("kiểm tra quyền người dùng", () => {
    expect(can("admin", "delete_case")).toBe(true);
    expect(can("manager", "view_finance")).toBe(false);
    expect(can("legal_staff", "edit_finance")).toBe(false);
    expect(can("accountant", "edit_finance")).toBe(false);
  });

  it("tạo hồ sơ mới qua repository", () => {
    const repository = new DemoRepository(demoData);
    const caseItem = repository.createCase({
      customerId: "c-001",
      propertyIds: ["p-001"],
      title: "Hồ sơ kiểm thử tạo mới",
      serviceType: "Sang tên",
      serviceFee: 9_000_000,
      estimatedCost: 1_000_000,
      assignedTo: "u-staff",
      receivedDate: "2026-07-22",
      internalDueDate: "2026-07-30",
      promisedDate: "2026-08-02",
      createdBy: "u-admin"
    });
    expect(caseItem.caseCode).toBe("HS-2026-0087");
    expect(repository.getCaseBundle(caseItem.id)?.customer.fullName).toBe("Nguyễn Phước Đức");
  });

  it("thêm lần nộp và cập nhật trạng thái", () => {
    const repository = new DemoRepository(demoData);
    const submission = repository.addSubmission(
      {
        caseId: "case-001",
        submissionCode: "TEST-001",
        procedureType: "Tách thửa",
        receivingAgency: "Cơ quan demo",
        submittedDate: "2026-07-22",
        expectedReturnDate: "2026-08-01",
        submittedBy: "u-admin",
        applicantName: "Nguyễn Phước Đức",
        status: "Đã nộp"
      },
      "u-admin"
    );
    repository.updateCaseStatus("case-001", "Có kết quả", "u-admin");
    const bundle = repository.getCaseBundle("case-001");
    expect(bundle?.submissions.some((item) => item.id === submission.id)).toBe(true);
    expect(bundle?.caseItem.status).toBe("Có kết quả");
  });

  it("bàn giao tài liệu bản chính qua phiếu bàn giao", () => {
    const repository = new DemoRepository(demoData);
    repository.transferDocument({
      documentId: "doc-001",
      fromUserId: "u-manager",
      toUserId: "u-staff",
      transferType: "Bàn giao nội bộ",
      transferredAt: "2026-07-22T09:00:00+07:00",
      createdBy: "u-admin"
    });
    const document = repository.getData().documents.find((item) => item.id === "doc-001");
    expect(document?.currentHolderId).toBe("u-staff");
  });

  it("đánh dấu tài liệu đã bàn giao khách thay vì gán nhầm cho nhân viên", () => {
    const repository = new DemoRepository(demoData);
    repository.transferDocument({
      documentId: "doc-001",
      toUserId: "u-staff",
      transferType: "Bàn giao khách",
      transferredAt: "2026-07-23T09:00:00+07:00",
      createdBy: "u-admin",
    });
    const document = repository.getData().documents.find((item) => item.id === "doc-001");
    expect(document?.currentHolderId).toBeUndefined();
    expect(document?.returnedDate).toBe("2026-07-23");
  });

  it("tạo cảnh báo theo rule đến hạn, quá hạn và công nợ", () => {
    const alerts = buildAlerts(demoData, "2026-07-22");
    expect(alerts.some((alert) => alert.title.includes("Quá hạn"))).toBe(true);
    expect(alerts.some((alert) => alert.title.includes("Bàn giao"))).toBe(true);
  });
});
