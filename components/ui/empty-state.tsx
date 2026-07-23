import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "Không có dữ liệu",
  message = "Chưa có thông tin nào để hiển thị.",
  icon,
}: EmptyStateProps) {
  return (
    <div className="luxe-panel rounded-[1.75rem] flex flex-col items-center justify-center py-14 px-5 text-center">
      <div className="w-16 h-16 rounded-full bg-[linear-gradient(135deg,#fff7e6,#f1dfb2)] border border-[rgba(198,152,53,0.16)] flex items-center justify-center mb-4 text-[#ab7e24]">
        {icon ?? <FolderOpen size={28} />}
      </div>
      <p className="text-base font-semibold text-[#3a2914] mb-1">{title}</p>
      <p className="text-sm text-[#8b7858] max-w-sm">{message}</p>
    </div>
  );
}
