import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createLocation } from "@/server/services/locations";
import { validateRow } from "@/lib/bulk-import/validate";
import { createImportJob, validateNextBatch, commitNextBatch } from "@/server/services/bulk-import";
import { createTestAccount, createTestUser, cleanupAccount } from "./helpers";

describe("location creation", () => {
  let accountId: string;

  afterEach(async () => {
    if (accountId) await cleanupAccount(accountId);
  });

  it("creates a location scoped to the given account", async () => {
    const account = await createTestAccount();
    accountId = account.id;

    const location = await createLocation(accountId, {
      name: "Test Gas Stop",
      type: "GAS_STATION",
      city: "Austin",
      state: "TX",
    });

    expect(location.accountId).toBe(accountId);
    expect(location.name).toBe("Test Gas Stop");
    expect(location.status).toBe("ACTIVE");

    const found = await prisma.location.findUnique({ where: { id: location.id } });
    expect(found).not.toBeNull();
  });
});

describe("bulk import row validation", () => {
  const validRow = {
    "Location Name": "Sunrise Truck Stop",
    "Location Type": "Truck Stop",
    "Restaurant Add-on": "Yes",
    "Address Line 1": "4400 Highway 87",
    City: "Lubbock",
    State: "TX",
    "ZIP Code": "79404",
    "Contact Name": "Maria Gomez",
    "Contact Email": "maria@example.com",
    "Contact Phone": "806-555-0111",
    Timezone: "America/Chicago",
  };

  it("accepts a fully valid row and normalizes it", () => {
    const result = validateRow(validRow);
    expect(result.valid).toBe(true);
    expect(result.normalized).toMatchObject({
      name: "Sunrise Truck Stop",
      type: "TRUCK_STOP",
      hasRestaurant: true,
      state: "TX",
    });
  });

  it("flags every missing required field by name", () => {
    const result = validateRow({ ...validRow, "Location Name": "", "Contact Email": "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: Location Name");
    expect(result.errors).toContain("Missing required field: Contact Email");
  });

  it("rejects an invalid Location Type with a specific message", () => {
    const result = validateRow({ ...validRow, "Location Type": "Spaceship" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid Location Type "Spaceship"'))).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = validateRow({ ...validRow, "Contact Email": "not-an-email" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid Contact Email"))).toBe(true);
  });

  it("rejects a malformed ZIP code", () => {
    const result = validateRow({ ...validRow, "ZIP Code": "abc" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid ZIP Code"))).toBe(true);
  });

  it("rejects an unrecognized state code", () => {
    const result = validateRow({ ...validRow, State: "ZZ" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid State"))).toBe(true);
  });

  it("defaults Restaurant Add-on to No when blank and Timezone when blank", () => {
    const result = validateRow({ ...validRow, "Restaurant Add-on": "", Timezone: "" });
    expect(result.valid).toBe(true);
    expect(result.normalized?.hasRestaurant).toBe(false);
    expect(result.normalized?.timezone).toBe("America/Chicago");
  });
});

describe("bulk import job pipeline", () => {
  let accountId: string;

  afterEach(async () => {
    if (accountId) await cleanupAccount(accountId);
  });

  it("validates then commits only valid rows, leaving invalid rows uncommitted with reasons", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const user = await createTestUser(accountId);

    const rows = [
      {
        "Location Name": "Good Row Store",
        "Location Type": "Gas Station",
        "Restaurant Add-on": "No",
        "Address Line 1": "1 Main St",
        City: "Austin",
        State: "TX",
        "ZIP Code": "78701",
        "Contact Name": "Pat Kim",
        "Contact Email": "pat@example.com",
        "Contact Phone": "",
        Timezone: "",
      },
      {
        "Location Name": "",
        "Location Type": "Gas Station",
        "Restaurant Add-on": "No",
        "Address Line 1": "2 Main St",
        City: "Austin",
        State: "TX",
        "ZIP Code": "78701",
        "Contact Name": "",
        "Contact Email": "bad-email",
        "Contact Phone": "",
        Timezone: "",
      },
    ];

    const job = await createImportJob(accountId, user.id, "test.csv", rows);
    expect(job.totalRows).toBe(2);

    const validation = await validateNextBatch(job.id, accountId);
    expect(validation.validated).toBe(2);
    expect(validation.job.validCount).toBe(1);
    expect(validation.job.invalidCount).toBe(1);
    expect(validation.job.status).toBe("READY");

    const commit = await commitNextBatch(job.id, accountId);
    expect(commit.imported).toBe(1);
    expect(commit.skipped).toBe(1);
    expect(commit.job.status).toBe("COMPLETED");

    const createdLocations = await prisma.location.findMany({ where: { accountId } });
    expect(createdLocations).toHaveLength(1);
    expect(createdLocations[0].name).toBe("Good Row Store");

    const invalidRow = await prisma.bulkImportRow.findFirst({ where: { jobId: job.id, status: "INVALID" } });
    expect(invalidRow).not.toBeNull();
    expect((invalidRow!.errors as string[]).length).toBeGreaterThan(0);
  });
});
