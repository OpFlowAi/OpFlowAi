import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { requireAccountAdmin } from "@/lib/authz";
import { listLocationsForAccount } from "@/server/services/locations";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createLocationAction, updateLocationAction, setLocationStatusAction } from "@/server/actions/locations";

const LOCATION_TYPES = [
  { value: "GAS_STATION", label: "Gas Station" },
  { value: "TRUCK_STOP", label: "Truck Stop" },
  { value: "GROCERY_STORE", label: "Grocery Store" },
] as const;

function LocationFormFields({ defaults }: { defaults?: Partial<Record<string, string>> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Name
        <input
          name="name"
          required
          defaultValue={defaults?.name}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-purple"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Type
        <select
          name="type"
          required
          defaultValue={defaults?.type}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-purple"
        >
          {LOCATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Address
        <input
          name="addressLine1"
          defaultValue={defaults?.addressLine1}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-purple"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted col-span-1">
          City
          <input
            name="city"
            defaultValue={defaults?.city}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-purple"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted col-span-1">
          State
          <input
            name="state"
            defaultValue={defaults?.state}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-purple"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted col-span-1">
          ZIP
          <input
            name="postalCode"
            defaultValue={defaults?.postalCode}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-purple"
          />
        </label>
      </div>
    </div>
  );
}

export default async function LocationsPage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");
  const session = await requireAccountAdmin();

  const locations = await listLocationsForAccount(session.user.accountId!);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Location Management</h1>
        <p className="text-sm text-muted mt-1">{locations.length} locations on your account</p>
      </div>

      <Card>
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <Plus size={16} className="text-brand-purple" /> Add a new location
          </summary>
          <form action={createLocationAction} className="mt-4 flex flex-col gap-3">
            <LocationFormFields />
            <button className="self-start rounded-xl gradient-brand text-white text-sm font-medium px-4 py-2">
              Create location
            </button>
          </form>
        </details>
      </Card>

      <div className="flex flex-col gap-3">
        {locations.map((loc) => (
          <Card key={loc.id}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground">{loc.name}</span>
                  <Badge tone="neutral">{loc.type.replace("_", " ")}</Badge>
                  <Badge tone={loc.status === "ACTIVE" ? "success" : "neutral"}>{loc.status}</Badge>
                </div>
                <span className="text-xs text-muted-2">
                  {loc._count.staffMembers} staff &middot; {loc._count.inventoryItems} inventory items
                </span>
              </summary>

              <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
                <form action={updateLocationAction} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={loc.id} />
                  <LocationFormFields
                    defaults={{
                      name: loc.name,
                      type: loc.type,
                      addressLine1: loc.addressLine1 ?? "",
                      city: loc.city ?? "",
                      state: loc.state ?? "",
                      postalCode: loc.postalCode ?? "",
                    }}
                  />
                  <button className="self-start rounded-xl border border-border bg-surface-2 text-sm font-medium px-4 py-2 hover:bg-surface-hover">
                    Save changes
                  </button>
                </form>

                <form action={setLocationStatusAction}>
                  <input type="hidden" name="id" value={loc.id} />
                  <input type="hidden" name="status" value={loc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                  <button
                    className={
                      loc.status === "ACTIVE"
                        ? "rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm font-medium px-4 py-2 hover:bg-danger/20"
                        : "rounded-xl border border-success/30 bg-success/10 text-success text-sm font-medium px-4 py-2 hover:bg-success/20"
                    }
                  >
                    {loc.status === "ACTIVE" ? "Deactivate location" : "Reactivate location"}
                  </button>
                </form>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
