import { prisma } from "@/lib/prisma";

export async function listAlerts(locationId: string, unreadOnly = false) {
  return prisma.alert.findMany({
    where: { locationId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markAlertRead(id: string) {
  return prisma.alert.update({ where: { id }, data: { isRead: true } });
}

export async function markAllAlertsRead(locationId: string) {
  return prisma.alert.updateMany({ where: { locationId, isRead: false }, data: { isRead: true } });
}
