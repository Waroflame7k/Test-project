import type { CaseStatus } from "@/types/domain";

const statusColors: Record<CaseStatus, string> = {
  "Mới tiếp nhận": "bg-[#f4ead2] text-[#8c6418] border-[#dfc08a]",
  "Đang chuẩn bị": "bg-[#f7efdc] text-[#7a5a20] border-[#e4c98d]",
  "Đã nộp": "bg-[#efe6d4] text-[#6f5320] border-[#dec08c]",
  "Cần bổ sung": "bg-[#fff0d5] text-[#ab6612] border-[#f0c170]",
  "Chờ khách cung cấp": "bg-[#fdf2de] text-[#aa7422] border-[#ebcd92]",
  "Chờ nộp thuế": "bg-[#feedd7] text-[#b56a12] border-[#efc37d]",
  "Đang giải quyết": "bg-[#f2ecdd] text-[#6f5f38] border-[#daca9f]",
  "Có kết quả": "bg-[#edf3e7] text-[#556934] border-[#c8d4af]",
  "Đã nhận kết quả": "bg-[#edf5ea] text-[#41663c] border-[#b9d1b8]",
  "Đã bàn giao khách": "bg-[#eef4ea] text-[#53703a] border-[#c4d1b3]",
  "Hoàn tất": "bg-[#f1efe8] text-[#6d6453] border-[#ddd3be]",
  "Tạm dừng": "bg-[#f4f0e8] text-[#867765] border-[#e0d2c1]",
  "Hồ sơ bị trả": "bg-[#fff0eb] text-[#ab5844] border-[#efc0b4]",
  "Khách hủy": "bg-[#fff3ee] text-[#b35b4d] border-[#efc4b6]",
  "Đang khiếu nại": "bg-[#f6efe7] text-[#8a6251] border-[#ddc6b6]",
};

interface StatusBadgeProps {
  status: CaseStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colors = statusColors[status] ?? "bg-[#f1efe8] text-[#6d6453] border-[#ddd3be]";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-[0.01em] ${colors} ${className}`}
    >
      {status}
    </span>
  );
}
