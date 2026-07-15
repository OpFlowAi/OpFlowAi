import { create } from "zustand";

export type LocationSummary = {
  id: string;
  name: string;
  type: "GAS_STATION" | "TRUCK_STOP" | "GROCERY_STORE";
  city: string | null;
  state: string | null;
};

interface LocationState {
  locations: LocationSummary[];
  activeLocationId: string | null;
  hydrate: (locations: LocationSummary[], activeLocationId: string | null) => void;
  setActiveLocationId: (id: string) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  activeLocationId: null,
  hydrate: (locations, activeLocationId) => set({ locations, activeLocationId }),
  setActiveLocationId: (id) => set({ activeLocationId: id }),
}));
