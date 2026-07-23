import type { UserRole } from "@/types/domain";
import type { CaseTask } from "@/types/domain";

export function canSeeAllTasks(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function visibleTasksForRole(tasks: CaseTask[], role: UserRole, userId: string): CaseTask[] {
  if (canSeeAllTasks(role)) return tasks;
  return tasks.filter((task) => task.assignedTo === userId);
}
