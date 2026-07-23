import type { Priority } from "@/types/domain";

const priorityColors: Record<Priority, string> = {
  Thấp: "bg-[#f3f0e8] text-[#75654c] border-[#ddd3be]",
  "Trung bình": "bg-[#f4ead5] text-[#8d651b] border-[#e2c791]",
  Cao: "bg-[#fff0d8] text-[#b36f12] border-[#efc782]",
  Khẩn: "bg-[#fff1ea] text-[#b7583b] border-[#efc1b0]",
};

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const colors = priorityColors[priority] ?? "bg-[#f3f0e8] text-[#75654c] border-[#ddd3be]";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${colors} ${className}`}>
      {priority}
    </span>
  );
}
