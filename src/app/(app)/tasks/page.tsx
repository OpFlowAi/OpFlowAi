import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Square, CheckSquare } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { listTasks } from "@/server/services/tasks";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { createTaskAction, setTaskStatusAction, toggleChecklistItemAction } from "@/server/actions/tasks";
import type { TaskType } from "@prisma/client";

const TYPE_LABEL: Record<TaskType, string> = {
  CHECKLIST: "Checklist",
  MAINTENANCE: "Maintenance",
  INCIDENT: "Incident",
  GENERAL: "General",
};

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;
const STATUS_TONE = { OPEN: "neutral", IN_PROGRESS: "info", DONE: "success", CANCELLED: "neutral" } as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; showDone?: string }>;
}) {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const { type, showDone } = await searchParams;
  const allTasks = await listTasks(location.id);
  const tasks = allTasks.filter((t) => {
    if (type && t.type !== type) return false;
    if (showDone !== "1" && (t.status === "DONE" || t.status === "CANCELLED")) return false;
    return true;
  });

  const types: TaskType[] = ["CHECKLIST", "MAINTENANCE", "INCIDENT", "GENERAL"];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Tasks</h1>
        <p className="text-sm text-muted mt-1">
          {location.name} &middot; Checklists, maintenance tickets &amp; incident reports
        </p>
      </div>

      <Card>
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <Plus size={16} className="text-brand-purple" /> New task
          </summary>
          <form action={createTaskAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="locationId" value={location.id} />
            <input
              name="title"
              required
              placeholder="Title"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
            />
            <textarea
              name="description"
              placeholder="Description (optional)"
              rows={2}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                name="type"
                defaultValue="GENERAL"
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <select
                name="priority"
                defaultValue="MEDIUM"
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <input
                name="dueDate"
                type="date"
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </div>
            <textarea
              name="checklistItems"
              placeholder="Checklist items, one per line (only used for Checklist type)"
              rows={3}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
            />
            <button className="self-start rounded-xl gradient-brand text-white text-sm font-medium px-4 py-2">
              Create task
            </button>
          </form>
        </details>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/tasks"
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
            !type
              ? "gradient-brand text-white border-transparent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          All types
        </Link>
        {types.map((t) => (
          <Link
            key={t}
            href={`/tasks?type=${t}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              type === t
                ? "gradient-brand text-white border-transparent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        <Link
          href={`/tasks?${type ? `type=${type}&` : ""}showDone=${showDone === "1" ? "0" : "1"}`}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
            showDone === "1"
              ? "gradient-brand text-white border-transparent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          Show completed
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <Card>
            <p className="text-sm text-muted text-center py-4">No tasks to show.</p>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{task.title}</span>
                    <Badge tone="neutral">{TYPE_LABEL[task.type]}</Badge>
                    <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
                    <Badge tone={STATUS_TONE[task.status]}>{task.status.replace("_", " ")}</Badge>
                  </div>
                  {task.description ? <p className="text-sm text-muted mt-1.5">{task.description}</p> : null}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-2 mt-1.5">
                    {task.dueDate ? <span>Due {new Date(task.dueDate).toLocaleDateString()}</span> : null}
                    {task.assignedTo ? <span>Assigned to {task.assignedTo.name}</span> : null}
                    {task.createdBy ? <span>Created by {task.createdBy.name}</span> : null}
                  </div>

                  {task.checklistItems.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-1">
                      {task.checklistItems.map((item) => (
                        <form key={item.id} action={toggleChecklistItemAction}>
                          <input type="hidden" name="locationId" value={location.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            className={cn(
                              "flex items-center gap-2 text-sm w-full text-left py-0.5",
                              item.isDone ? "text-muted-2 line-through" : "text-foreground"
                            )}
                          >
                            {item.isDone ? (
                              <CheckSquare size={15} className="text-success shrink-0" />
                            ) : (
                              <Square size={15} className="text-muted-2 shrink-0" />
                            )}
                            {item.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </div>

                {task.status !== "DONE" && task.status !== "CANCELLED" ? (
                  <div className="flex gap-2 shrink-0">
                    {task.status === "OPEN" ? (
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="locationId" value={location.id} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="status" value="IN_PROGRESS" />
                        <button className="rounded-lg border border-border bg-surface-2 text-xs font-medium px-3 py-1.5 hover:bg-surface-hover">
                          Start
                        </button>
                      </form>
                    ) : null}
                    <form action={setTaskStatusAction}>
                      <input type="hidden" name="locationId" value={location.id} />
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="DONE" />
                      <button className="rounded-lg gradient-brand text-white text-xs font-medium px-3 py-1.5">
                        Complete
                      </button>
                    </form>
                    <form action={setTaskStatusAction}>
                      <input type="hidden" name="locationId" value={location.id} />
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <button className="rounded-lg border border-border text-xs font-medium px-3 py-1.5 text-muted hover:text-danger hover:border-danger/40">
                        Cancel
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
