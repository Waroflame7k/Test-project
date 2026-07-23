"use client";

import { useState } from "react";
import { LogOut, Building2, Shield, CheckCircle2, FileText, Bell } from "lucide-react";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { ROLE_LABELS } from "@/lib/constants";

export function ProfileScreen() {
  const { data, logout } = useApp();
  const currentUser = useCurrentUser();
  const [notificationMessage, setNotificationMessage] = useState("");

  const myTotalCases =
    currentUser.role === "admin" || currentUser.role === "manager"
      ? data.cases.length
      : data.cases.filter((c) => c.assignedTo === currentUser.id).length;

  const myCompletedTasks = data.tasks.filter(
    (t) => t.assignedTo === currentUser.id && t.status === "Hoàn thành"
  ).length;

  const initials = currentUser.fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function sendTestNotification() {
    if (!("Notification" in window)) {
      setNotificationMessage("Thiết bị này chưa hỗ trợ thông báo web.");
      return;
    }

    const permission =
      Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") {
      setNotificationMessage("Bạn chưa cho phép thông báo. Hãy bật quyền Thông báo trong cài đặt trình duyệt.");
      return;
    }

    const title = "Hồ sơ BĐS";
    const options = {
      body: "Thông báo thử đã hoạt động trên thiết bị này.",
      tag: "ho-so-bds-test",
    };

    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    setNotificationMessage("Đã gửi thông báo thử.");
  }

  return (
    <div className="p-4 md:p-6 pb-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-[#1a3a8a] flex items-center justify-center mb-3">
            <span className="text-2xl font-extrabold text-white">{initials}</span>
          </div>
          <h2 className="text-lg font-extrabold text-[#1a3a8a]">{currentUser.fullName}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{currentUser.email}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 bg-[#1a3a8a] text-white text-xs font-semibold px-3 py-1 rounded-full">
            <Shield size={11} />
            {ROLE_LABELS[currentUser.role]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <FileText size={18} className="text-[#1a3a8a]" />
            </div>
            <p className="text-2xl font-extrabold text-[#1a3a8a]">{myTotalCases}</p>
            <p className="text-xs text-gray-400 mt-0.5">Hồ sơ phụ trách</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
            <p className="text-2xl font-extrabold text-green-600">{myCompletedTasks}</p>
            <p className="text-xs text-gray-400 mt-0.5">Việc hoàn thành</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Thông tin tài khoản</h3>
          <div className="space-y-3">
            <InfoRow label="Email" value={currentUser.email} />
            <InfoRow label="SĐT" value={currentUser.phone} />
            <InfoRow label="Vai trò" value={ROLE_LABELS[currentUser.role]} />
            <InfoRow
              label="Trạng thái"
              value={currentUser.active ? "Đang hoạt động" : "Đã khóa"}
              valueClass={currentUser.active ? "text-green-600" : "text-red-500"}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tổ chức</h3>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-[#1a3a8a]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{data.organization.brandName}</p>
              <p className="text-xs text-gray-400">{data.organization.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{data.organization.address}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Thông báo trên thiết bị</h3>
          <p className="text-xs leading-5 text-gray-500">
            Kiểm tra quyền thông báo của điện thoại. Thông báo thử hoạt động khi web app đang mở hoặc đã cài ra màn hình chính.
          </p>
          <button
            onClick={() => void sendTestNotification()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a3a8a] py-3 text-sm font-bold text-white transition-colors hover:bg-[#122d6a]"
          >
            <Bell size={17} />
            Gửi thông báo thử
          </button>
          {notificationMessage ? <p className="mt-3 text-xs font-medium text-[#1a3a8a]">{notificationMessage}</p> : null}
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs text-[#1a3a8a] font-semibold mb-1">Demo Mode</p>
          <p className="text-xs text-gray-500">
            Đây là dữ liệu demo. Tất cả thay đổi được lưu tạm thời trong trình duyệt và sẽ mất khi xóa dữ liệu.
          </p>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl py-4 transition-colors"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClass = "text-gray-800",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
