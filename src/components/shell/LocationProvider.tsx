"use client";

import { useEffect } from "react";
import { useLocationStore, type LocationSummary } from "@/store/location-store";

export function LocationProvider({
  locations,
  activeLocationId,
  children,
}: {
  locations: LocationSummary[];
  activeLocationId: string | null;
  children: React.ReactNode;
}) {
  const hydrate = useLocationStore((s) => s.hydrate);

  useEffect(() => {
    hydrate(locations, activeLocationId);
    // Re-hydrate whenever the server sends a (possibly new) active location,
    // e.g. after switching or on navigation to a fresh server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationId, locations.map((l) => l.id).join(",")]);

  return <>{children}</>;
}
