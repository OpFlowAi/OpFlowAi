import type { AgentAction } from "@prisma/client";
import { createTask } from "@/server/services/tasks";
import { logTimeOff } from "@/server/services/staffing";
import { markItemReordered } from "@/server/services/inventory";

/** Executes a previously-confirmed AgentAction's payload. Returns a human-readable result summary. */
export async function executeAgentAction(action: AgentAction, userId: string): Promise<string> {
  const payload = action.payload as Record<string, unknown>;

  switch (action.actionType) {
    case "ADD_TASK": {
      const task = await createTask(action.locationId, userId, {
        title: payload.title as string,
        description: payload.description as string | undefined,
        type: payload.type as never,
        priority: payload.priority as never,
        dueDate: payload.dueDate ? new Date(payload.dueDate as string) : undefined,
      });
      return `Created task "${task.title}".`;
    }
    case "LOG_TIME_OFF": {
      const request = await logTimeOff(
        action.locationId,
        payload.staffMemberId as string,
        new Date(payload.startDate as string),
        new Date(payload.endDate as string),
        payload.reason as string | undefined
      );
      return `Logged a time-off request for ${request.staffMember.name} (${new Date(
        request.startDate
      ).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}), pending approval.`;
    }
    case "MARK_ITEM_REORDERED": {
      const po = await markItemReordered(action.locationId, payload.itemId as string, userId);
      return `Placed a reorder with ${po.supplier.name} for ${payload.itemName} (status: ${po.status}).`;
    }
    default:
      throw new Error(`Cannot execute unsupported action type: ${action.actionType}`);
  }
}
