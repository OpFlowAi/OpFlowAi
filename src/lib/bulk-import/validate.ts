import type { LocationType } from "@prisma/client";

const LOCATION_TYPE_MAP: Record<string, LocationType> = {
  "gas station": "GAS_STATION",
  "gas_station": "GAS_STATION",
  "truck stop": "TRUCK_STOP",
  "truck_stop": "TRUCK_STOP",
  "grocery store": "GROCERY_STORE",
  "grocery": "GROCERY_STORE",
  "grocery_store": "GROCERY_STORE",
};

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC", "PR",
]);

const YES_VALUES = new Set(["yes", "y", "true", "1"]);
const NO_VALUES = new Set(["no", "n", "false", "0", ""]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const PHONE_RE = /^[\d\s().+-]{7,20}$/;

export interface NormalizedLocationRow {
  name: string;
  type: LocationType;
  hasRestaurant: boolean;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  timezone: string;
}

export interface RowValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: NormalizedLocationRow;
}

function get(row: Record<string, string>, key: string): string {
  return (row[key] ?? "").toString().trim();
}

/** Validates + normalizes a single raw CSV row. Never throws - all problems surface as error strings. */
export function validateRow(row: Record<string, string>): RowValidationResult {
  const errors: string[] = [];

  const name = get(row, "Location Name");
  if (!name) errors.push("Missing required field: Location Name");
  else if (name.length > 255) errors.push("Location Name is too long (max 255 characters)");

  const rawType = get(row, "Location Type");
  const type = LOCATION_TYPE_MAP[rawType.toLowerCase()];
  if (!rawType) errors.push("Missing required field: Location Type");
  else if (!type) errors.push(`Invalid Location Type "${rawType}" - must be Gas Station, Truck Stop, or Grocery Store`);

  const rawRestaurant = get(row, "Restaurant Add-on").toLowerCase();
  let hasRestaurant = false;
  if (YES_VALUES.has(rawRestaurant)) hasRestaurant = true;
  else if (NO_VALUES.has(rawRestaurant)) hasRestaurant = false;
  else errors.push(`Invalid Restaurant Add-on value "${row["Restaurant Add-on"]}" - must be Yes or No`);

  const addressLine1 = get(row, "Address Line 1");
  if (!addressLine1) errors.push("Missing required field: Address Line 1");

  const city = get(row, "City");
  if (!city) errors.push("Missing required field: City");

  const rawState = get(row, "State");
  const state = rawState.toUpperCase();
  if (!rawState) errors.push("Missing required field: State");
  else if (!US_STATE_CODES.has(state)) errors.push(`Invalid State "${rawState}" - must be a 2-letter US state code`);

  const postalCode = get(row, "ZIP Code");
  if (!postalCode) errors.push("Missing required field: ZIP Code");
  else if (!ZIP_RE.test(postalCode)) errors.push(`Invalid ZIP Code "${postalCode}" - expected format 12345 or 12345-6789`);

  const contactName = get(row, "Contact Name");
  if (!contactName) errors.push("Missing required field: Contact Name");

  const contactEmail = get(row, "Contact Email");
  if (!contactEmail) errors.push("Missing required field: Contact Email");
  else if (!EMAIL_RE.test(contactEmail)) errors.push(`Invalid Contact Email "${contactEmail}"`);

  const contactPhone = get(row, "Contact Phone");
  if (contactPhone && !PHONE_RE.test(contactPhone)) {
    errors.push(`Invalid Contact Phone "${contactPhone}"`);
  }

  const rawTimezone = get(row, "Timezone");
  const timezone = rawTimezone || "America/Chicago";
  if (rawTimezone && !rawTimezone.includes("/")) {
    errors.push(`Invalid Timezone "${rawTimezone}" - expected an IANA timezone like America/Chicago`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    normalized: {
      name,
      type: type!,
      hasRestaurant,
      addressLine1,
      city,
      state,
      postalCode,
      contactName,
      contactEmail,
      contactPhone: contactPhone || undefined,
      timezone,
    },
  };
}
