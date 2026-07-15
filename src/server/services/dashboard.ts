import { prisma } from "@/lib/prisma";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  subWeeks,
  subMonths,
  subDays,
  format,
} from "date-fns";

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? 100 : null;
  return ((current - prior) / prior) * 100;
}

async function revenueSum(locationId: string, from: Date, to: Date) {
  const result = await prisma.revenueEntry.aggregate({
    where: { locationId, date: { gte: from, lt: to } },
    _sum: { grossRevenue: true, transactionCount: true },
  });
  return {
    revenue: Number(result._sum.grossRevenue ?? 0),
    transactionCount: result._sum.transactionCount ?? 0,
  };
}

export async function getDashboardSummary(locationId: string) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = startOfDay(subDays(now, -1));

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const priorWeekStart = subWeeks(weekStart, 1);

  const monthStart = startOfMonth(now);
  const priorMonthStart = subMonths(monthStart, 1);

  const [today_, weekToDate, priorWeekToDate, monthToDate, priorMonthToDate, dailySeriesRaw] =
    await Promise.all([
      revenueSum(locationId, today, tomorrow),
      revenueSum(locationId, weekStart, tomorrow),
      // compare against the same number of days into the prior week
      revenueSum(locationId, priorWeekStart, new Date(priorWeekStart.getTime() + (tomorrow.getTime() - weekStart.getTime()))),
      revenueSum(locationId, monthStart, tomorrow),
      revenueSum(locationId, priorMonthStart, new Date(priorMonthStart.getTime() + (tomorrow.getTime() - monthStart.getTime()))),
      prisma.revenueEntry.findMany({
        where: { locationId, date: { gte: subDays(today, 27), lt: tomorrow } },
        orderBy: { date: "asc" },
        select: { date: true, grossRevenue: true, transactionCount: true },
      }),
    ]);

  const dailySeries = dailySeriesRaw.map((d) => ({
    date: format(d.date, "yyyy-MM-dd"),
    label: format(d.date, "EEE M/d"),
    revenue: Number(d.grossRevenue),
    transactionCount: d.transactionCount,
  }));

  const last7 = dailySeries.slice(-7);
  const prior7 = dailySeries.slice(-14, -7);
  const last7Total = last7.reduce((s, d) => s + d.revenue, 0);
  const prior7Total = prior7.reduce((s, d) => s + d.revenue, 0);

  return {
    today: today_,
    weekToDate: { ...weekToDate, changePct: pctChange(weekToDate.revenue, priorWeekToDate.revenue) },
    monthToDate: { ...monthToDate, changePct: pctChange(monthToDate.revenue, priorMonthToDate.revenue) },
    last7Days: { revenue: last7Total, changePct: pctChange(last7Total, prior7Total) },
    dailySeries: last7,
    trendSeries: dailySeries,
  };
}

export async function getLocationAtAGlance(locationId: string) {
  const [lowStockItems, openTaskCount, overdueComplianceCount, unreadAlertCount, pendingTimeOff] =
    await Promise.all([
      // Prisma can't compare two columns directly in a `where`, so filter in JS.
      prisma.inventoryItem.findMany({
        where: { locationId },
        select: { currentStock: true, reorderPoint: true },
      }),
      prisma.task.count({ where: { locationId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.complianceItem.count({ where: { locationId, status: "OVERDUE" } }),
      prisma.alert.count({ where: { locationId, isRead: false } }),
      prisma.timeOffRequest.count({
        where: { staffMember: { locationId }, status: "PENDING" },
      }),
    ]);
  const lowStockCount = lowStockItems.filter(
    (i) => Number(i.currentStock) <= Number(i.reorderPoint)
  ).length;

  return { lowStockCount, openTaskCount, overdueComplianceCount, unreadAlertCount, pendingTimeOff };
}
