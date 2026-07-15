import Link from "next/link";
import { redirect } from "next/navigation";
import { startOfWeek, addDays, addWeeks, format, isSameDay } from "date-fns";
import { getActiveLocation } from "@/lib/active-location";
import { getShiftsInRange, getPendingTimeOffRequests } from "@/server/services/staffing";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { decideTimeOffAction } from "@/server/actions/staffing";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function StaffingPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const { week } = await searchParams;
  const weekOffset = week ? parseInt(week, 10) || 0 : 0;
  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekEnd = addDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [schedule, pendingTimeOff] = await Promise.all([
    getShiftsInRange(location.id, weekStart, weekEnd),
    getPendingTimeOffRequests(location.id),
  ]);

  const avgDailyCost = schedule.totalCost / 7;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Staffing</h1>
          <p className="text-sm text-muted mt-1">
            {location.name} &middot; {schedule.staff.length} active staff
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/staffing?week=${weekOffset - 1}`}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-hover"
          >
            &larr; Prev
          </Link>
          <span className="text-sm text-muted px-2">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Link
            href={`/staffing?week=${weekOffset + 1}`}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-hover"
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Weekly labor cost" value={formatCurrency(schedule.totalCost)} delta={`${schedule.totalShifts} shifts`} />
        <StatTile label="Avg. daily cost" value={formatCurrency(avgDailyCost)} />
        <StatTile
          label="Pending time-off"
          value={String(pendingTimeOff.length)}
          deltaTone={pendingTimeOff.length > 0 ? "up" : "neutral"}
          delta={pendingTimeOff.length > 0 ? "Needs review" : "All clear"}
        />
      </div>

      {pendingTimeOff.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Time-Off Requests</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-3">
            {pendingTimeOff.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-3"
              >
                <div>
                  <span className="font-medium text-foreground">{req.staffMember.name}</span>
                  <span className="text-sm text-muted ml-2">
                    {format(req.startDate, "MMM d")} - {format(req.endDate, "MMM d")}
                  </span>
                  {req.reason ? <p className="text-xs text-muted-2 mt-0.5">{req.reason}</p> : null}
                </div>
                <div className="flex gap-2">
                  <form action={decideTimeOffAction}>
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="requestId" value={req.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="rounded-lg gradient-brand text-white text-xs font-medium px-3 py-1.5">
                      Approve
                    </button>
                  </form>
                  <form action={decideTimeOffAction}>
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="requestId" value={req.id} />
                    <input type="hidden" name="decision" value="deny" />
                    <button className="rounded-lg border border-border text-xs font-medium px-3 py-1.5 text-muted hover:text-danger hover:border-danger/40">
                      Deny
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
                <th className="px-4 py-3 font-medium sticky left-0 bg-surface">Staff</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className="px-3 py-3 font-medium min-w-[130px]">
                    {format(d, "EEE M/d")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.staff.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 sticky left-0 bg-surface">
                    <div className="font-medium text-foreground">{member.name}</div>
                    <div className="text-xs text-muted-2">
                      {member.title} &middot; {formatCurrency(member.hourlyRate)}/hr
                    </div>
                  </td>
                  {days.map((d) => {
                    const dayShifts = member.shifts.filter((s) => isSameDay(s.startTime, d));
                    return (
                      <td key={d.toISOString()} className="px-3 py-3 align-top">
                        {dayShifts.length === 0 ? (
                          <span className="text-xs text-muted-2">Off</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {dayShifts.map((s) => (
                              <Badge key={s.id} tone={s.status === "COMPLETED" ? "success" : "info"}>
                                {format(s.startTime, "h a")}-{format(s.endTime, "h a")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
