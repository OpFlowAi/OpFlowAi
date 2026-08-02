/** The exact CSV column headers the bulk importer expects, in order. */
export const TEMPLATE_COLUMNS = [
  "Location Name",
  "Location Type",
  "Restaurant Add-on",
  "Address Line 1",
  "City",
  "State",
  "ZIP Code",
  "Contact Name",
  "Contact Email",
  "Contact Phone",
  "Timezone",
] as const;

const EXAMPLE_ROW = [
  "Riverside Fuel & Go",
  "Gas Station",
  "No",
  "1220 Riverside Dr",
  "Lubbock",
  "TX",
  "79401",
  "Jordan Lee",
  "jordan@example.com",
  "806-555-0142",
  "America/Chicago",
];

function toCsvRow(values: string[]): string {
  return values
    .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(",");
}

export function generateTemplateCsv(): string {
  return [toCsvRow([...TEMPLATE_COLUMNS]), toCsvRow(EXAMPLE_ROW)].join("\n") + "\n";
}
