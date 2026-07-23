import type { AppData, Case } from "@/types/domain";
import { daysUntil, todayIso } from "@/lib/date";
import { receivableForCase } from "@/lib/case-utils";

export interface AlertItem {
  id: string;
  caseId: string;
  title: string;
  message: string;
  level: "Đỏ" | "Cam" | "Xanh";
}

export function buildAlerts(data: AppData, nowIso = todayIso()): AlertItem[] {
  const alerts: AlertItem[] = [];
  const openCases = data.cases.filter((caseItem) => !caseItem.archivedAt && caseItem.status !== "Hoàn tất");

  openCases.forEach((caseItem: Case) => {
    const days = daysUntil(caseItem.promisedDate, nowIso);
    if ([5, 2, 0].includes(days)) {
      alerts.push({
        id: `${caseItem.id}-due-${days}`,
        caseId: caseItem.id,
        title: days === 0 ? "Đến hạn" : `Còn ${days} ngày đến hạn`,
        message: `${caseItem.caseCode} cần theo dõi trước ngày hẹn ${caseItem.promisedDate}.`,
        level: days === 0 ? "Cam" : "Xanh",
      });
    }
    if (days === -1 || days <= -3) {
      alerts.push({
        id: `${caseItem.id}-overdue-${days}`,
        caseId: caseItem.id,
        title: days === -1 ? "Quá hạn 1 ngày" : "Quá hạn từ 3 ngày",
        message: `${caseItem.caseCode} đã quá hạn, cần xử lý ngay.`,
        level: "Đỏ",
      });
    }
    if (caseItem.status === "Cần bổ sung" && daysUntil(caseItem.updatedAt.slice(0, 10), nowIso) < -2) {
      alerts.push({
        id: `${caseItem.id}-supplement`,
        caseId: caseItem.id,
        title: "Cần bổ sung quá 2 ngày",
        message: `${caseItem.caseCode} đang chờ bổ sung chưa xử lý.`,
        level: "Cam",
      });
    }
    if (caseItem.status === "Có kết quả" && daysUntil(caseItem.updatedAt.slice(0, 10), nowIso) < -2) {
      alerts.push({
        id: `${caseItem.id}-result`,
        caseId: caseItem.id,
        title: "Có kết quả quá 2 ngày",
        message: `${caseItem.caseCode} cần nhận kết quả và cập nhật bàn giao.`,
        level: "Cam",
      });
    }
    if (caseItem.status === "Đã bàn giao khách" && receivableForCase(caseItem, data.payments) > 0) {
      alerts.push({
        id: `${caseItem.id}-debt`,
        caseId: caseItem.id,
        title: "Bàn giao nhưng chưa thu đủ phí",
        message: `${caseItem.caseCode} còn công nợ khách hàng.`,
        level: "Đỏ",
      });
    }
  });

  return alerts;
}
