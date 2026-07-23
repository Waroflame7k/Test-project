import type { UserRole } from "@/types/domain";

export type PermissionAction =
  | "manage_users"
  | "view_all_cases"
  | "assign_staff"
  | "view_reports"
  | "update_progress"
  | "delete_case"
  | "view_finance"
  | "edit_finance"
  | "view_confidential_documents"
  | "add_documents"
  | "add_submissions"
  | "complete_tasks";

const permissions: Record<UserRole, PermissionAction[]> = {
  admin: [
    "manage_users",
    "view_all_cases",
    "assign_staff",
    "view_reports",
    "update_progress",
    "delete_case",
    "view_finance",
    "edit_finance",
    "view_confidential_documents",
    "add_documents",
    "add_submissions",
    "complete_tasks",
  ],
  manager: [
    "view_all_cases",
    "assign_staff",
    "view_reports",
    "update_progress",
    "delete_case",
    "view_finance",
    "add_submissions",
    "complete_tasks",
  ],
  legal_staff: ["update_progress", "add_documents", "add_submissions", "complete_tasks"],
  accountant: ["view_finance", "edit_finance", "view_reports", "complete_tasks"],
  viewer: [],
};

export function can(role: UserRole, action: PermissionAction): boolean {
  return permissions[role].includes(action);
}
