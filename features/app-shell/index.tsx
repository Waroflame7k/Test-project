"use client";

import { BarChart3, Bell, ChevronLeft, ClipboardCheck, Folder, FolderOpen, Home, Sparkles, User, WalletCards } from "lucide-react";
import { AppProvider, useApp } from "@/features/app-shell/app-context";
import { LoginScreen } from "@/features/auth/login-screen";
import { CaseDetailScreen } from "@/features/cases/case-detail-screen";
import { CasesScreen } from "@/features/cases/cases-screen";
import { CreateCaseWizard } from "@/features/cases/create-case-wizard";
import { ScanReceiptScreen } from "@/features/cases/scan-receipt-screen";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { FinanceScreen } from "@/features/finance/finance-screen";
import { ProfileScreen } from "@/features/profile/profile-screen";
import { ReportsScreen } from "@/features/reports/reports-screen";
import { TaskCalendarScreen } from "@/features/tasks/task-calendar-screen";
import { TasksScreen } from "@/features/tasks/tasks-screen";
import { ROLE_LABELS } from "@/lib/constants";
import { can } from "@/lib/permissions";

const TAB_SCREENS = ["dashboard", "cases", "tasks", "reports", "finance", "profile"] as const;
type TabScreen = (typeof TAB_SCREENS)[number];

const TABS: { key: TabScreen; label: string; icon: React.ReactNode; activeIcon: React.ReactNode }[] = [
  {
    key: "dashboard",
    label: "Tổng quan",
    icon: <Home size={19} strokeWidth={1.75} />,
    activeIcon: <Home size={19} strokeWidth={2.2} />,
  },
  {
    key: "cases",
    label: "Hồ sơ",
    icon: <Folder size={19} strokeWidth={1.75} />,
    activeIcon: <Folder size={19} strokeWidth={2.2} />,
  },
  {
    key: "tasks",
    label: "Công việc",
    icon: <ClipboardCheck size={19} strokeWidth={1.75} />,
    activeIcon: <ClipboardCheck size={19} strokeWidth={2.2} />,
  },
  {
    key: "reports",
    label: "Báo cáo",
    icon: <BarChart3 size={19} strokeWidth={1.75} />,
    activeIcon: <BarChart3 size={19} strokeWidth={2.2} />,
  },
  {
    key: "finance",
    label: "Thu chi",
    icon: <WalletCards size={19} strokeWidth={1.75} />,
    activeIcon: <WalletCards size={19} strokeWidth={2.2} />,
  },
  {
    key: "profile",
    label: "Cá nhân",
    icon: <User size={19} strokeWidth={1.75} />,
    activeIcon: <User size={19} strokeWidth={2.2} />,
  },
];

function headerTitle(screen: string): string {
  switch (screen) {
    case "dashboard":
      return "Tổng quan";
    case "cases":
      return "Hồ sơ khách hàng";
    case "case-detail":
      return "Chi tiết hồ sơ";
    case "create-case":
      return "Tạo hồ sơ khách hàng";
    case "scan-receipt":
      return "Tạo biên nhận hồ sơ";
    case "tasks":
      return "Công việc";
    case "task-calendar":
      return "Lịch công việc";
    case "reports":
      return "Báo cáo";
    case "finance":
      return "Thu chi";
    case "profile":
      return "Cá nhân";
    default:
      return "HỒ SƠ BĐS";
  }
}

function activeTabFor(screen: string): TabScreen {
  if (screen === "case-detail" || screen === "create-case" || screen === "scan-receipt") return "cases";
  if (screen === "task-calendar") return "tasks";
  if (TAB_SCREENS.includes(screen as TabScreen)) return screen as TabScreen;
  return "dashboard";
}

function AppShellInner() {
  const { currentUser, currentScreen, screenParams, navigate } = useApp();

  if (!currentUser) {
    return <LoginScreen />;
  }

  const activeTab = activeTabFor(currentScreen);
  const navigationTabs = TABS.filter((tab) => {
    if (tab.key === "reports") return can(currentUser.role, "view_reports");
    if (tab.key === "finance") return can(currentUser.role, "view_finance");
    return true;
  });
  const showBack =
    currentScreen === "case-detail" || currentScreen === "create-case" || currentScreen === "scan-receipt" || currentScreen === "task-calendar";
  const caseId = typeof screenParams.caseId === "string" ? screenParams.caseId : "";

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="hidden md:flex w-[216px] shrink-0 p-2">
        <div className="luxe-panel-strong rounded-[1.25rem] w-full flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b luxe-divider">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[1rem] gold-gradient-bg text-white flex items-center justify-center shrink-0">
                <FolderOpen size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#a1865b]">Nguyễn Khoa BĐS</p>
                  <Sparkles size={12} className="text-[#c69835]" />
                </div>
                <div className="text-xl font-extrabold text-[#362310] leading-tight">HỒ SƠ BĐS</div>
                <p className="text-sm text-[#8d7a5a]">Quy trình hồ sơ pháp lý tinh gọn</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-2 py-3 space-y-1">
            {navigationTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => navigate(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-[0.95rem] text-sm font-semibold transition-all relative ${
                    isActive ? "luxe-nav-item-active" : "luxe-nav-item"
                  }`}
                >
                  {isActive && <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full gold-gradient-bg" />}
                  <span className="ml-1 text-[#a97a21]">{isActive ? tab.activeIcon : tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="px-2 pb-2">
            <div className="luxe-panel rounded-[0.95rem] px-3 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full gold-gradient-bg text-white flex items-center justify-center text-sm font-bold shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#3b2a15] truncate">{currentUser.fullName}</div>
                <div className="text-[11px] text-[#8c7858] truncate">{ROLE_LABELS[currentUser.role]}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden p-0 md:p-2 md:pl-0">
        <header className="shrink-0 z-20 px-2 pt-2 md:px-0 md:pt-0">
          <div className="luxe-panel-strong rounded-[0.95rem] px-3 py-2 md:rounded-[1.1rem] md:px-4 md:py-3 flex items-center justify-between gap-2 md:gap-3">
            {showBack ? (
              <button
                onClick={() => navigate(activeTab)}
                className="md:hidden h-9 w-9 flex items-center justify-center rounded-full luxe-button-ghost transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="md:hidden h-9 w-9 flex items-center justify-center rounded-full bg-[rgba(255,248,233,0.8)] border border-[rgba(198,152,53,0.14)]">
                <FolderOpen size={17} className="text-[#ab7e24]" />
              </div>
            )}

            <div className="flex-1 min-w-0 text-center md:text-left">
              <p className="hidden md:block text-[11px] uppercase tracking-[0.24em] text-[#a1865b] mb-1">Bảng điều khiển</p>
              <h1 className="text-[15px] md:text-[1.2rem] font-extrabold tracking-tight text-[#342312] truncate">
                {headerTitle(currentScreen)}
              </h1>
            </div>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button className="w-10 h-10 flex items-center justify-center rounded-full luxe-button-ghost transition-colors">
                <Bell size={18} />
              </button>
              <div className="hidden md:flex w-10 h-10 rounded-full bg-[rgba(255,246,224,0.9)] border border-[rgba(198,152,53,0.16)] items-center justify-center text-sm font-bold text-[#8b6418]">
                {currentUser.fullName.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-2 pb-20 pt-2 md:px-0 md:pb-0 md:pt-2">
          {currentScreen === "dashboard" && <DashboardScreen />}
          {currentScreen === "cases" && <CasesScreen />}
          {currentScreen === "case-detail" && caseId && <CaseDetailScreen caseId={caseId} />}
          {currentScreen === "create-case" && <CreateCaseWizard />}
          {currentScreen === "scan-receipt" && <ScanReceiptScreen />}
          {currentScreen === "tasks" && <TasksScreen />}
          {currentScreen === "task-calendar" && <TaskCalendarScreen />}
          {currentScreen === "reports" && <ReportsScreen />}
          {currentScreen === "finance" && <FinanceScreen />}
          {currentScreen === "profile" && <ProfileScreen />}
        </main>

        {!showBack && (
          <nav className="md:hidden fixed bottom-1 left-1 right-1 z-20 safe-bottom">
            <div className="luxe-panel-strong rounded-[1rem] px-1 py-1 flex items-center justify-between">
              {navigationTabs.filter((tab) => tab.key !== "finance").map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => navigate(tab.key)}
                    className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 rounded-xl transition-all ${
                      isActive ? "bg-[rgba(255,245,220,0.94)] text-[#8b6418]" : "text-[#8a7758]"
                    }`}
                  >
                    <span>{isActive ? tab.activeIcon : tab.icon}</span>
                    <span className="text-[9px] font-semibold">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <AppProvider>
      <AppShellInner />
    </AppProvider>
  );
}
