import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireSession, accessibleLocationIds, canAccessLocation } from "@/lib/authz";
import { getLocation } from "@/server/services/locations";
import { listStaffMembers } from "@/server/services/staffing";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { addOnboardingStaffAction, finishOnboardingAction } from "@/server/actions/onboarding";

const STEPS = ["Location details", "Add your team", "Reorder settings"];

const LOCATION_TYPE_LABEL: Record<string, string> = {
  GAS_STATION: "Gas Station",
  TRUCK_STOP: "Truck Stop",
  GROCERY_STORE: "Grocery Store",
};

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold border",
                done && "gradient-brand text-white border-transparent",
                active && !done && "border-brand-purple text-brand-purple",
                !active && !done && "border-border text-muted-2"
              )}
            >
              {done ? <CheckCircle2 size={14} /> : step}
            </div>
            <span className={cn("text-xs", active ? "text-foreground font-medium" : "text-muted-2")}>{label}</span>
            {step < STEPS.length ? <span className="w-6 h-px bg-border mx-1" /> : null}
          </div>
        );
      })}
    </div>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; step?: string }>;
}) {
  const session = await requireSession();
  const { locationId, step: stepParam } = await searchParams;

  if (!locationId) {
    const allowedIds = await accessibleLocationIds(session);
    if (allowedIds.length > 0) redirect("/dashboard");
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold gradient-brand-text mb-2">No locations yet</h1>
          <p className="text-sm text-muted">
            Your account doesn&apos;t have any locations assigned yet. Contact your OpsFlow AI
            administrator to get set up.
          </p>
        </div>
      </div>
    );
  }

  if (!canAccessLocation(session.user, locationId)) {
    redirect("/dashboard");
  }

  const location = await getLocation(locationId);
  const step = Math.min(3, Math.max(1, parseInt(stepParam ?? "1", 10) || 1));
  const staff = step >= 2 ? await listStaffMembers(locationId) : [];

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold gradient-brand-text">Welcome to OpsFlow AI</h1>
          <p className="text-sm text-muted mt-1">Let&apos;s get {location.name} set up.</p>
        </div>

        <StepIndicator current={step} />

        <Card>
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">Location details</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-2">Name</dt>
                    <dd className="text-foreground">{location.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-2">Type</dt>
                    <dd className="text-foreground">{LOCATION_TYPE_LABEL[location.type]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-2">Address</dt>
                    <dd className="text-foreground">{location.addressLine1 || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-2">City, State</dt>
                    <dd className="text-foreground">
                      {location.city ? `${location.city}, ${location.state ?? ""}` : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex justify-between">
                <Link
                  href="/locations"
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-hover"
                >
                  Edit details
                </Link>
                <Link
                  href={`/onboarding?locationId=${locationId}&step=2`}
                  className="rounded-xl gradient-brand text-white px-4 py-2 text-sm font-medium"
                >
                  Continue
                </Link>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-foreground">Add your team</h2>
              <form action={addOnboardingStaffAction} className="grid grid-cols-2 gap-3">
                <input type="hidden" name="locationId" value={locationId} />
                <input
                  name="name"
                  placeholder="Full name"
                  required
                  className="col-span-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
                />
                <input
                  name="title"
                  placeholder="Title (e.g. Cashier)"
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
                />
                <input
                  name="hourlyRate"
                  type="number"
                  step="0.01"
                  placeholder="Hourly rate"
                  required
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
                />
                <select
                  name="employmentType"
                  defaultValue="PART_TIME"
                  className="col-span-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
                >
                  <option value="PART_TIME">Part-time</option>
                  <option value="FULL_TIME">Full-time</option>
                </select>
                <button className="col-span-2 rounded-lg border border-border bg-surface-2 py-2 text-sm font-medium hover:bg-surface-hover">
                  + Add staff member
                </button>
              </form>

              {staff.length > 0 ? (
                <ul className="flex flex-col gap-1.5 text-sm border-t border-border pt-3">
                  {staff.map((s) => (
                    <li key={s.id} className="flex justify-between text-muted">
                      <span className="text-foreground">{s.name}</span>
                      <span>
                        {s.title ?? "Staff"} &middot; ${Number(s.hourlyRate).toFixed(2)}/hr
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-2">
                  You can add staff now, or skip and add them later from the Staffing screen.
                </p>
              )}

              <div className="flex justify-between border-t border-border pt-4">
                <Link
                  href={`/onboarding?locationId=${locationId}&step=1`}
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-hover"
                >
                  Back
                </Link>
                <Link
                  href={`/onboarding?locationId=${locationId}&step=3`}
                  className="rounded-xl gradient-brand text-white px-4 py-2 text-sm font-medium"
                >
                  Continue
                </Link>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <form action={finishOnboardingAction} className="flex flex-col gap-4">
              <input type="hidden" name="locationId" value={locationId} />
              <h2 className="text-sm font-semibold text-foreground">Auto-reorder settings</h2>
              <p className="text-xs text-muted">
                Choose how OpsFlow AI handles inventory reorders when items run low. You can change
                this anytime from the Inventory screen.
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer has-[:checked]:border-brand-purple">
                  <input type="radio" name="mode" value="DRAFT_APPROVAL" defaultChecked className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Draft &amp; Approve</span>
                    <span className="block text-xs text-muted">
                      Low-stock items are drafted into a purchase order for a manager to review and approve.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer has-[:checked]:border-brand-purple">
                  <input type="radio" name="mode" value="AUTOMATIC" className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Automatic</span>
                    <span className="block text-xs text-muted">
                      Low-stock items are ordered from their preferred supplier automatically.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex justify-between border-t border-border pt-4">
                <Link
                  href={`/onboarding?locationId=${locationId}&step=2`}
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-hover"
                >
                  Back
                </Link>
                <button className="rounded-xl gradient-brand text-white px-4 py-2 text-sm font-medium">
                  Finish setup
                </button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
