import { prisma } from "@/lib/prisma";
import { addDays, differenceInMinutes } from "date-fns";

export async function getUpcomingShifts(locationId: string, days = 7) {
  const now = new Date();
  const shifts = await prisma.shift.findMany({
    where: {
      locationId,
      startTime: { gte: now, lt: addDays(now, days) },
      status: "SCHEDULED",
    },
    include: { staffMember: true },
    orderBy: { startTime: "asc" },
  });
  return shifts;
}

export async function getLaborCostSummary(locationId: string, days = 7) {
  const now = new Date();
  const shifts = await prisma.shift.findMany({
    where: {
      locationId,
      startTime: { gte: addDays(now, -days), lt: addDays(now, days) },
      status: { in: ["SCHEDULED", "COMPLETED"] },
    },
    include: { staffMember: true },
  });

  let pastCost = 0;
  let upcomingCost = 0;
  for (const shift of shifts) {
    const hours = differenceInMinutes(shift.endTime, shift.startTime) / 60;
    const cost = hours * Number(shift.staffMember.hourlyRate);
    if (shift.startTime < now) pastCost += cost;
    else upcomingCost += cost;
  }
  return {
    pastCost: Math.round(pastCost * 100) / 100,
    upcomingCost: Math.round(upcomingCost * 100) / 100,
    shiftCount: shifts.length,
  };
}

export async function listStaffMembers(locationId: string) {
  return prisma.staffMember.findMany({ where: { locationId }, orderBy: { name: "asc" } });
}

/** All shifts for every staff member at a location within [from, to), for the weekly schedule grid. */
export async function getShiftsInRange(locationId: string, from: Date, to: Date) {
  const [staff, shifts] = await Promise.all([
    prisma.staffMember.findMany({ where: { locationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.shift.findMany({
      where: { locationId, startTime: { gte: from, lt: to }, status: { not: "CANCELLED" } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  let totalCost = 0;
  const shiftsByStaff = new Map<string, typeof shifts>();
  for (const staffMember of staff) shiftsByStaff.set(staffMember.id, []);
  for (const shift of shifts) {
    shiftsByStaff.get(shift.staffMemberId)?.push(shift);
    const staffMember = staff.find((s) => s.id === shift.staffMemberId);
    if (staffMember) {
      const hours = differenceInMinutes(shift.endTime, shift.startTime) / 60;
      totalCost += hours * Number(staffMember.hourlyRate);
    }
  }

  return {
    staff: staff.map((s) => ({ ...s, hourlyRate: Number(s.hourlyRate), shifts: shiftsByStaff.get(s.id) ?? [] })),
    totalCost: Math.round(totalCost * 100) / 100,
    totalShifts: shifts.length,
  };
}

/** Scheduled labor hours per day in range, to flag thin-coverage days. */
export async function getDailyCoverage(locationId: string, from: Date, to: Date) {
  const shifts = await prisma.shift.findMany({
    where: { locationId, startTime: { gte: from, lt: to }, status: { not: "CANCELLED" } },
  });
  const byDay = new Map<string, { hours: number; count: number }>();
  for (const shift of shifts) {
    const key = shift.startTime.toISOString().slice(0, 10);
    const hours = differenceInMinutes(shift.endTime, shift.startTime) / 60;
    const existing = byDay.get(key) ?? { hours: 0, count: 0 };
    existing.hours += hours;
    existing.count += 1;
    byDay.set(key, existing);
  }
  return byDay;
}

export async function getPendingTimeOffRequests(locationId: string) {
  return prisma.timeOffRequest.findMany({
    where: { staffMember: { locationId }, status: "PENDING" },
    include: { staffMember: true },
    orderBy: { requestedAt: "desc" },
  });
}

export async function decideTimeOffRequest(id: string, userId: string, decision: "approve" | "deny") {
  return prisma.timeOffRequest.update({
    where: { id },
    data: {
      status: decision === "approve" ? "APPROVED" : "DENIED",
      decidedById: userId,
      decidedAt: new Date(),
    },
  });
}

/** Resolves a staff member by (fuzzy, case-insensitive) name within a location. */
export async function findStaffMemberByName(locationId: string, name: string) {
  const staff = await prisma.staffMember.findMany({ where: { locationId } });
  const lower = name.trim().toLowerCase();
  const exact = staff.filter((s) => s.name.toLowerCase() === lower);
  if (exact.length === 1) return { match: exact[0], candidates: [] };
  const partial = staff.filter((s) => s.name.toLowerCase().includes(lower));
  if (partial.length === 1) return { match: partial[0], candidates: [] };
  return { match: null, candidates: partial.length > 0 ? partial : staff };
}

export async function logTimeOff(
  locationId: string,
  staffMemberId: string,
  startDate: Date,
  endDate: Date,
  reason: string | undefined
) {
  return prisma.timeOffRequest.create({
    data: { staffMemberId, startDate, endDate, reason, status: "PENDING" },
    include: { staffMember: true },
  });
}
