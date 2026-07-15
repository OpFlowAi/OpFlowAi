import { prisma } from "@/lib/prisma";
import type { TaskPriority, TaskStatus, TaskType } from "@prisma/client";

export async function listTasks(locationId: string, status?: TaskStatus) {
  return prisma.task.findMany({
    where: { locationId, ...(status ? { status } : {}) },
    include: { assignedTo: true, createdBy: true, checklistItems: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function createTask(
  locationId: string,
  createdById: string | undefined,
  input: {
    title: string;
    description?: string;
    type?: TaskType;
    priority?: TaskPriority;
    dueDate?: Date;
    checklistLabels?: string[];
  }
) {
  return prisma.task.create({
    data: {
      locationId,
      createdById,
      title: input.title,
      description: input.description,
      type: input.type ?? "GENERAL",
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate,
      checklistItems: input.checklistLabels?.length
        ? { create: input.checklistLabels.map((label, i) => ({ label, sortOrder: i })) }
        : undefined,
    },
  });
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return prisma.task.update({
    where: { id },
    data: { status, resolvedAt: status === "DONE" ? new Date() : null },
  });
}

export async function toggleChecklistItem(id: string) {
  const item = await prisma.taskChecklistItem.findUniqueOrThrow({ where: { id } });
  return prisma.taskChecklistItem.update({ where: { id }, data: { isDone: !item.isDone } });
}
