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
  | "complete_tasks"
  | "manage_case_records";

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
    "manage_case_records",
  ],
  manager: [
    "view_all_cases",
    "assign_staff",
    "view_reports",
    "update_progress",
    "delete_case",
    "add_documents",
    "add_submissions",
    "complete_tasks",
    "manage_case_records",
  ],
  legal_staff: ["update_progress", "add_documents", "add_submissions", "complete_tasks", "manage_case_records"],
  accountant: ["view_reports", "complete_tasks"],
  viewer: [],
};

export function can(role: UserRole, action: PermissionAction): boolean {
  return permissions[role].includes(action);
}
