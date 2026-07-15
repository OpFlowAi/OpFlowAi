import type Anthropic from "@anthropic-ai/sdk";
import type { AgentActionType } from "@prisma/client";

export type ToolKind = "read" | "write";

export interface ToolMeta {
  kind: ToolKind;
  actionType?: AgentActionType;
}

export const TOOL_META: Record<string, ToolMeta> = {
  get_dashboard_summary: { kind: "read" },
  get_inventory_status: { kind: "read" },
  get_staffing_schedule: { kind: "read" },
  get_time_off_requests: { kind: "read" },
  get_compliance_status: { kind: "read" },
  get_alerts: { kind: "read" },
  get_tasks: { kind: "read" },
  get_bank_summary: { kind: "read" },
  get_suppliers: { kind: "read" },
  add_task: { kind: "write", actionType: "ADD_TASK" },
  log_time_off: { kind: "write", actionType: "LOG_TIME_OFF" },
  mark_item_reordered: { kind: "write", actionType: "MARK_ITEM_REORDERED" },
};

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_dashboard_summary",
    description:
      "Get today's, week-to-date, and month-to-date revenue for the active location, plus the last 7 days daily revenue trend.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_inventory_status",
    description:
      "List inventory items for the active location with current stock, par level, reorder point, status (OK/LOW/CRITICAL), and preferred supplier. Optionally filter by category name.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category name to filter by" },
      },
    },
  },
  {
    name: "get_staffing_schedule",
    description:
      "Get upcoming scheduled shifts and labor cost summary for the active location over the next N days (default 7).",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Number of days to look ahead" } },
    },
  },
  {
    name: "get_time_off_requests",
    description: "List time-off requests for staff at the active location, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "APPROVED", "DENIED"] },
      },
    },
  },
  {
    name: "get_compliance_status",
    description:
      "List compliance checklist items (inspections, certifications) for the active location with due dates and status (OVERDUE/DUE_SOON/UPCOMING).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_alerts",
    description: "List recent cross-category alerts/notifications for the active location.",
    input_schema: {
      type: "object",
      properties: { unread_only: { type: "boolean" } },
    },
  },
  {
    name: "get_tasks",
    description:
      "List tasks (checklists, maintenance tickets, incident reports) for the active location, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] },
      },
    },
  },
  {
    name: "get_bank_summary",
    description: "Get connected bank account balances and recent transactions for the active location (read-only).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_suppliers",
    description: "List suppliers/vendors for the account with lead times, ratings, and recent order history.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_task",
    description:
      "Propose adding a new task (checklist item, maintenance ticket, or incident report) to the active location. This requires the user's explicit confirmation before it is created.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        type: { type: "string", enum: ["CHECKLIST", "MAINTENANCE", "INCIDENT", "GENERAL"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        due_date: { type: "string", description: "ISO date YYYY-MM-DD, optional" },
      },
      required: ["title"],
    },
  },
  {
    name: "log_time_off",
    description:
      "Propose logging a time-off request for a staff member at the active location. This requires the user's explicit confirmation before it is created.",
    input_schema: {
      type: "object",
      properties: {
        staff_member_name: { type: "string" },
        start_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        end_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        reason: { type: "string" },
      },
      required: ["staff_member_name", "start_date", "end_date"],
    },
  },
  {
    name: "mark_item_reordered",
    description:
      "Propose marking an inventory item as reordered (creates a purchase order with its preferred supplier). This requires the user's explicit confirmation before it is placed.",
    input_schema: {
      type: "object",
      properties: {
        item_name: { type: "string" },
      },
      required: ["item_name"],
    },
  },
];
