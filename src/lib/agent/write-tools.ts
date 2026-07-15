import { prisma } from "@/lib/prisma";
import { findStaffMemberByName } from "@/server/services/staffing";
import type { AgentActionType, TaskPriority, TaskType } from "@prisma/client";
import type { AgentContext } from "@/lib/agent/read-executors";

export interface ProposalResult {
  ok: boolean;
  summary?: string;
  payload?: Record<string, unknown>;
  error?: string;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Validates + resolves a proposed write-tool call into a confirmable payload. Never mutates data. */
export async function proposeWriteTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext
): Promise<ProposalResult> {
  switch (name) {
    case "add_task": {
      const title = String(input.title ?? "").trim();
      if (!title) return { ok: false, error: "A task title is required." };
      const dueDate = parseDate(input.due_date);
      return {
        ok: true,
        summary: `Add task "${title}"${dueDate ? ` due ${dueDate.toLocaleDateString()}` : ""}`,
        payload: {
          title,
          description: input.description ?? undefined,
          type: (input.type as TaskType) ?? "GENERAL",
          priority: (input.priority as TaskPriority) ?? "MEDIUM",
          dueDate: dueDate?.toISOString(),
        },
      };
    }
    case "log_time_off": {
      const name = String(input.staff_member_name ?? "").trim();
      if (!name) return { ok: false, error: "A staff member name is required." };
      const startDate = parseDate(input.start_date);
      const endDate = parseDate(input.end_date);
      if (!startDate || !endDate) return { ok: false, error: "Valid start and end dates are required." };

      const { match, candidates } = await findStaffMemberByName(ctx.locationId, name);
      if (!match) {
        const names = candidates.map((c) => c.name).join(", ");
        return {
          ok: false,
          error: candidates.length
            ? `Couldn't find a unique match for "${name}". Did you mean one of: ${names}?`
            : `No staff member found matching "${name}" at this location.`,
        };
      }

      return {
        ok: true,
        summary: `Log time off for ${match.name} from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        payload: {
          staffMemberId: match.id,
          staffMemberName: match.name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: input.reason ?? undefined,
        },
      };
    }
    case "mark_item_reordered": {
      const name = String(input.item_name ?? "").trim();
      if (!name) return { ok: false, error: "An item name is required." };

      const items = await prisma.inventoryItem.findMany({
        where: { locationId: ctx.locationId },
        include: { preferredSupplier: true },
      });
      const lower = name.toLowerCase();
      const exact = items.filter((i) => i.name.toLowerCase() === lower);
      const matches = exact.length === 1 ? exact : items.filter((i) => i.name.toLowerCase().includes(lower));

      if (matches.length !== 1) {
        const names = matches.map((i) => i.name).join(", ");
        return {
          ok: false,
          error: matches.length
            ? `Couldn't find a unique match for "${name}". Did you mean one of: ${names}?`
            : `No inventory item found matching "${name}" at this location.`,
        };
      }
      const item = matches[0];
      if (!item.preferredSupplierId || !item.preferredSupplier) {
        return { ok: false, error: `${item.name} has no preferred supplier configured, so I can't reorder it.` };
      }
      const quantity = Number(item.reorderQuantity) || 1;
      const cost = quantity * Number(item.unitCost);
      return {
        ok: true,
        summary: `Reorder ${quantity} ${item.unit} of ${item.name} from ${item.preferredSupplier.name} ($${cost.toFixed(2)})`,
        payload: { itemId: item.id, itemName: item.name },
      };
    }
    default:
      return { ok: false, error: `Unknown action: ${name}` };
  }
}

export const ACTION_TYPE_LABEL: Record<AgentActionType, string> = {
  ADD_TASK: "Add task",
  LOG_TIME_OFF: "Log time off",
  MARK_ITEM_REORDERED: "Mark item reordered",
  CREATE_PURCHASE_ORDER: "Create purchase order",
  APPROVE_PURCHASE_ORDER: "Approve purchase order",
  COMPLETE_COMPLIANCE_ITEM: "Complete compliance item",
};
