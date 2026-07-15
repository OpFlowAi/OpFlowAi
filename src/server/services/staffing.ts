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
