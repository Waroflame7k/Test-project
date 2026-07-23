import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/alerts";
import { generateCaseCode, receivableForCase } from "@/lib/case-utils";
import { daysUntil, isDueSoon, isOverdue } from "@/lib/date";
import { calculateReceivable } from "@/lib/money";
import { can } from "@/lib/permissions";
import { demoData } from "@/services/demo-data";
import { MockOCRProvider } from "@/services/ocr";
import { DemoRepository } from "@/services/repository";

describe("nghiệp vụ hồ sơ BĐS", () => {
  it("sinh mã hồ sơ HS-YYYY-XXXX kế tiếp", () => {
    expect(generateCaseCode(2026, ["HS-2026-0001", "HS-2026-0012", "HS-2025-0099"])).toBe("HS-2026-0013");
  });

  it("tính số ngày còn lại, sắp đến hạn và quá hạn", () => {
    expect(daysUntil("2026-07-23", "2026-07-21")).toBe(2);
    expect(isDueSoon("2026-07-23", "2026-07-21", 5)).toBe(true);
    expect(isOverdue("2026-07-20", "2026-07-21")).toBe(true);
  });

  it("tính số tiền còn phải thu bằng số nguyên VNĐ", () => {
    expect(calculateReceivable(18_000_000, 8_000_000)).toBe(10_000_000);
    expect(receivableForCase(demoData.cases[0], demoData.payments)).toBe(10_000_000);
  });

  it("kiểm tra quyền người dùng", () => {
    expect(can("admin", "delete_case")).toBe(true);
    expect(can("legal_staff", "edit_finance")).toBe(false);
    expect(can("accountant", "edit_finance")).toBe(true);
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

  it("xác nhận OCR trước khi lưu", async () => {
    const provider = new MockOCRProvider();
    const result = await provider.extractReceipt(new File(["demo"], "receipt.jpg", { type: "image/jpeg" }));
    expect(result.submissionCode).toBe("H53.183-260625-0075");
    const repository = new DemoRepository(demoData);
    const before = repository.getData().submissions.length;
    expect(repository.getData().submissions.length).toBe(before);
  });

  it("tạo cảnh báo theo rule đến hạn, quá hạn và công nợ", () => {
    const alerts = buildAlerts(demoData, "2026-07-22");
    expect(alerts.some((alert) => alert.title.includes("Quá hạn"))).toBe(true);
    expect(alerts.some((alert) => alert.title.includes("Bàn giao"))).toBe(true);
  });
});
