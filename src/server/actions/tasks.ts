"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/authz";
import { createTask, setTaskStatus, toggleChecklistItem } from "@/server/services/tasks";
import type { TaskPriority, TaskStatus, TaskType } from "@prisma/client";

export async function createTaskAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const session = await requireLocationAccess(locationId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const checklistRaw = String(formData.get("checklistItems") ?? "");
  const type = String(formData.get("type")) as TaskType;

  await createTask(locationId, session.user.id, {
    title,
    description: String(formData.get("description") ?? "") || undefined,
    type,
    priority: String(formData.get("priority")) as TaskPriority,
    dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    checklistLabels:
      type === "CHECKLIST"
        ? checklistRaw
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : undefined,
  });

  revalidatePath("/tasks");
}

export async function setTaskStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const taskId = String(formData.get("taskId"));
  const status = String(formData.get("status")) as TaskStatus;
  await requireLocationAccess(locationId);
  await setTaskStatus(taskId, status);
  revalidatePath("/tasks");
}

export async function toggleChecklistItemAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const itemId = String(formData.get("itemId"));
  await requireLocationAccess(locationId);
  await toggleChecklistItem(itemId);
  revalidatePath("/tasks");
}
