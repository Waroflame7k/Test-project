export interface OCRResult {
  caseCode: string;
  submittedDate: string;
  expectedReturnDate: string;
  procedureType: string;
  receivingAgency: string;
  submittedBy: string;
  applicantName: string;
  submissionCode: string;
}

export interface OCRProvider {
  extractReceipt(file: File): Promise<OCRResult>;
}

export class MockOCRProvider implements OCRProvider {
  async extractReceipt(file: File): Promise<OCRResult> {
    void file;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      caseCode: "HS-2026-0073",
      submittedDate: "2026-07-01",
      expectedReturnDate: "2026-07-23",
      procedureType: "Đăng ký biến động/tặng cho",
      receivingAgency: "Hành chính công xã Cần Giuộc",
      submittedBy: "Nguyễn Khánh Nam",
      applicantName: "Nguyễn Phước Đức",
      submissionCode: "H53.183-260625-0075"
    };
  }
}
