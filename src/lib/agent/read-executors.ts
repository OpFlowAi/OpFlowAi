import { getDashboardSummary } from "@/server/services/dashboard";
import { listInventory } from "@/server/services/inventory";
import { prisma } from "@/lib/prisma";
import { getUpcomingShifts, getLaborCostSummary, getPendingTimeOffRequests } from "@/server/services/staffing";
import { getComplianceOverview } from "@/server/services/compliance";
import { listAlerts } from "@/server/services/alerts";
import { listTasks } from "@/server/services/tasks";
import { getBankSummary } from "@/server/services/banking";
import { listSuppliers } from "@/server/services/suppliers";
import type { TaskStatus, TimeOffStatus } from "@prisma/client";

export interface AgentContext {
  locationId: string;
  accountId: string;
}

export async function executeReadTool(name: string, input: Record<string, unknown>, ctx: AgentContext) {
  switch (name) {
    case "get_dashboard_summary": {
      const summary = await getDashboardSummary(ctx.locationId);
      return {
        todayRevenue: summary.today.revenue,
        todayTransactionCount: summary.today.transactionCount,
        weekToDateRevenue: summary.weekToDate.revenue,
        weekChangePct: summary.weekToDate.changePct,
        monthToDateRevenue: summary.monthToDate.revenue,
        monthChangePct: summary.monthToDate.changePct,
        last7DaysDaily: summary.dailySeries,
      };
    }
    case "get_inventory_status": {
      const category = input.category as string | undefined;
      let categoryId: string | undefined;
      if (category) {
        const cat = await prisma.inventoryCategory.findFirst({
          where: { accountId: ctx.accountId, name: { equals: category, mode: "insensitive" } },
        });
        categoryId = cat?.id;
      }
      const items = await listInventory(ctx.locationId, categoryId);
      return items.map((i) => ({
        name: i.name,
        category: i.category.name,
        currentStock: i.currentStock,
        unit: i.unit,
        parLevel: i.parLevel,
        reorderPoint: i.reorderPoint,
        status: i.status,
        unitCost: i.unitCost,
        preferredSupplier: i.preferredSupplier?.name ?? null,
      }));
    }
    case "get_staffing_schedule": {
      const days = typeof input.days === "number" ? input.days : 7;
      const [shifts, laborCost] = await Promise.all([
        getUpcomingShifts(ctx.locationId, days),
        getLaborCostSummary(ctx.locationId, days),
      ]);
      return {
        laborCostSummary: laborCost,
        upcomingShifts: shifts.map((s) => ({
          staffMember: s.staffMember.name,
          position: s.position,
          start: s.startTime,
          end: s.endTime,
        })),
      };
    }
    case "get_time_off_requests": {
      const status = input.status as TimeOffStatus | undefined;
      if (status && status !== "PENDING") {
        const requests = await prisma.timeOffRequest.findMany({
          where: { staffMember: { locationId: ctx.locationId }, status },
          include: { staffMember: true },
        });
        return requests.map((r) => ({
          staffMember: r.staffMember.name,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          reason: r.reason,
        }));
      }
      const requests = await getPendingTimeOffRequests(ctx.locationId);
      return requests.map((r) => ({
        staffMember: r.staffMember.name,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        reason: r.reason,
      }));
    }
    case "get_compliance_status": {
      const items = await getComplianceOverview(ctx.locationId);
      return items.map((i) => ({
        title: i.title,
        category: i.category,
        frequency: i.frequency,
        nextDueDate: i.nextDueDate,
        status: i.status,
      }));
    }
    case "get_alerts": {
      const unreadOnly = input.unread_only === true;
      const alerts = await listAlerts(ctx.locationId, unreadOnly);
      return alerts.map((a) => ({
        category: a.category,
        severity: a.severity,
        title: a.title,
        message: a.message,
        isRead: a.isRead,
        createdAt: a.createdAt,
      }));
    }
    case "get_tasks": {
      const status = input.status as TaskStatus | undefined;
      const tasks = await listTasks(ctx.locationId, status);
      return tasks.map((t) => ({
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo?.name ?? null,
        dueDate: t.dueDate,
      }));
    }
    case "get_bank_summary": {
      return getBankSummary(ctx.locationId);
    }
    case "get_suppliers": {
      const suppliers = await listSuppliers(ctx.accountId);
      return suppliers.map((s) => ({
        name: s.name,
        leadTimeDays: s.leadTimeDays,
        rating: s.rating,
        category: s.category,
        recentOrderCount: s._count.purchaseOrders,
      }));
    }
    default:
      return { error: `Unknown read tool: ${name}` };
  }
}
