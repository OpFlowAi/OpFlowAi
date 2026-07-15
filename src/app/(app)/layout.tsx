import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveLocation } from "@/lib/active-location";
import { LocationProvider } from "@/components/shell/LocationProvider";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

const ACCOUNT_ADMIN_ROLES = new Set(["PLATFORM_ADMIN", "OWNER", "ADMIN"]);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, location, allowedIds } = await getActiveLocation();

  if (allowedIds.length === 0) {
    redirect("/onboarding");
  }

  const locations = await prisma.location.findMany({
    where: { id: { in: allowedIds } },
    select: { id: true, name: true, type: true, city: true, state: true },
    orderBy: { name: "asc" },
  });

  const unreadAlertCount = location
    ? await prisma.alert.count({ where: { locationId: location.id, isRead: false } })
    : 0;

  return (
    <LocationProvider locations={locations} activeLocationId={location?.id ?? null}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar isAccountAdmin={ACCOUNT_ADMIN_ROLES.has(session.user.role)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar userName={session.user.name ?? session.user.email ?? "User"} unreadAlertCount={unreadAlertCount} />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </LocationProvider>
  );
}
