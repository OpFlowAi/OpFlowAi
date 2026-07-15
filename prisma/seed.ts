import { PrismaClient, LocationType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding OpsFlow AI database...");

  const account = await prisma.account.create({
    data: {
      name: "Lonestar Fuel & Grocery Group",
      status: "ACTIVE",
    },
  });

  const [northgate, riverside, downtown] = await Promise.all([
    prisma.location.create({
      data: {
        accountId: account.id,
        name: "Northgate Travel Center",
        type: LocationType.TRUCK_STOP,
        city: "Amarillo",
        state: "TX",
        postalCode: "79101",
        addressLine1: "4501 I-40 Frontage Rd",
        reorderApprovalMode: "AUTOMATIC",
        openedAt: subDays(new Date(), 900),
      },
    }),
    prisma.location.create({
      data: {
        accountId: account.id,
        name: "Riverside Fuel & Go",
        type: LocationType.GAS_STATION,
        city: "Lubbock",
        state: "TX",
        postalCode: "79401",
        addressLine1: "1220 Riverside Dr",
        reorderApprovalMode: "DRAFT_APPROVAL",
        openedAt: subDays(new Date(), 500),
      },
    }),
    prisma.location.create({
      data: {
        accountId: account.id,
        name: "Downtown Market",
        type: LocationType.GROCERY_STORE,
        city: "Lubbock",
        state: "TX",
        postalCode: "79403",
        addressLine1: "812 Main St",
        reorderApprovalMode: "DRAFT_APPROVAL",
        openedAt: subDays(new Date(), 220),
      },
    }),
  ]);
  const locations = [northgate, riverside, downtown];

  const passwordHash = await bcrypt.hash("OpsFlow2026!", 10);

  const owner = await prisma.user.create({
    data: {
      accountId: account.id,
      email: "owner@lonestargroup.com",
      passwordHash,
      name: "Dana Whitfield",
      role: "OWNER",
      locationAccess: { create: locations.map((l) => ({ locationId: l.id })) },
    },
  });

  const manager = await prisma.user.create({
    data: {
      accountId: account.id,
      email: "manager.northgate@lonestargroup.com",
      passwordHash,
      name: "Marcus Reed",
      role: "MANAGER",
      locationAccess: { create: [{ locationId: northgate.id }] },
    },
  });

  await prisma.user.create({
    data: {
      accountId: null,
      email: "admin@opsflow.ai",
      passwordHash,
      name: "OpsFlow Platform Admin",
      role: "PLATFORM_ADMIN",
    },
  });

  // ---- Suppliers -----------------------------------------------------------
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        accountId: account.id,
        name: "McLane Company",
        contactName: "Sarah Combs",
        email: "orders@mclane-demo.com",
        phone: "555-201-4477",
        leadTimeDays: 2,
        rating: 4.6,
        category: "General Distribution",
      },
    }),
    prisma.supplier.create({
      data: {
        accountId: account.id,
        name: "Core-Mark",
        contactName: "James Ortiz",
        email: "sales@coremark-demo.com",
        phone: "555-201-9981",
        leadTimeDays: 3,
        rating: 4.2,
        category: "Convenience/Snacks",
      },
    }),
    prisma.supplier.create({
      data: {
        accountId: account.id,
        name: "Ben E. Keith Foods",
        contactName: "Priya Nair",
        email: "orders@benekeith-demo.com",
        phone: "555-201-3320",
        leadTimeDays: 4,
        rating: 4.8,
        category: "Fresh & Grocery",
      },
    }),
  ]);

  // ---- Inventory categories --------------------------------------------------
  const categoryNames = ["Fuel & Fluids", "Snacks & Candy", "Beverages", "Grocery Staples", "Tobacco", "Fresh Food"];
  const categories = await Promise.all(
    categoryNames.map((name, i) =>
      prisma.inventoryCategory.create({ data: { accountId: account.id, name, sortOrder: i } })
    )
  );
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const itemTemplates: {
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    parLevel: number;
    reorderPoint: number;
    reorderQuantity: number;
    unitCost: number;
    supplier: string;
  }[] = [
    { name: "Diesel Exhaust Fluid (2.5gal)", category: "Fuel & Fluids", unit: "case", currentStock: 4, parLevel: 20, reorderPoint: 8, reorderQuantity: 20, unitCost: 22.5, supplier: "McLane Company" },
    { name: "Motor Oil 5W-30 (1qt)", category: "Fuel & Fluids", unit: "case", currentStock: 12, parLevel: 24, reorderPoint: 10, reorderQuantity: 24, unitCost: 34.0, supplier: "McLane Company" },
    { name: "Snickers King Size", category: "Snacks & Candy", unit: "box", currentStock: 3, parLevel: 12, reorderPoint: 5, reorderQuantity: 12, unitCost: 18.75, supplier: "Core-Mark" },
    { name: "Lay's Classic 2.625oz", category: "Snacks & Candy", unit: "box", currentStock: 9, parLevel: 15, reorderPoint: 6, reorderQuantity: 15, unitCost: 21.0, supplier: "Core-Mark" },
    { name: "Monster Energy 16oz", category: "Beverages", unit: "case", currentStock: 6, parLevel: 20, reorderPoint: 8, reorderQuantity: 20, unitCost: 28.5, supplier: "Core-Mark" },
    { name: "Coca-Cola 20oz", category: "Beverages", unit: "case", currentStock: 15, parLevel: 24, reorderPoint: 10, reorderQuantity: 24, unitCost: 19.2, supplier: "Core-Mark" },
    { name: "Bottled Water 16.9oz (24pk)", category: "Beverages", unit: "case", currentStock: 5, parLevel: 15, reorderPoint: 6, reorderQuantity: 15, unitCost: 4.75, supplier: "Core-Mark" },
    { name: "Whole Milk Gallon", category: "Fresh Food", unit: "unit", currentStock: 8, parLevel: 30, reorderPoint: 12, reorderQuantity: 30, unitCost: 3.85, supplier: "Ben E. Keith Foods" },
    { name: "Eggs Grade A Dozen", category: "Fresh Food", unit: "unit", currentStock: 10, parLevel: 36, reorderPoint: 15, reorderQuantity: 36, unitCost: 2.9, supplier: "Ben E. Keith Foods" },
    { name: "White Bread Loaf", category: "Grocery Staples", unit: "unit", currentStock: 14, parLevel: 25, reorderPoint: 10, reorderQuantity: 25, unitCost: 2.1, supplier: "Ben E. Keith Foods" },
    { name: "Marlboro Red Carton", category: "Tobacco", unit: "carton", currentStock: 20, parLevel: 40, reorderPoint: 15, reorderQuantity: 40, unitCost: 62.0, supplier: "McLane Company" },
    { name: "Copenhagen Long Cut", category: "Tobacco", unit: "roll", currentStock: 6, parLevel: 15, reorderPoint: 6, reorderQuantity: 15, unitCost: 41.5, supplier: "McLane Company" },
  ];

  const supplierByName = Object.fromEntries(suppliers.map((s) => [s.name, s]));

  for (const loc of locations) {
    for (const [i, tpl] of itemTemplates.entries()) {
      // Slightly vary stock per location so the demo has different alerts everywhere.
      const variance = ((loc.id.charCodeAt(loc.id.length - 1) + i) % 5) - 2;
      await prisma.inventoryItem.create({
        data: {
          locationId: loc.id,
          categoryId: catByName[tpl.category].id,
          name: tpl.name,
          unit: tpl.unit,
          currentStock: Math.max(0, tpl.currentStock + variance),
          parLevel: tpl.parLevel,
          reorderPoint: tpl.reorderPoint,
          reorderQuantity: tpl.reorderQuantity,
          unitCost: tpl.unitCost,
          preferredSupplierId: supplierByName[tpl.supplier].id,
          lastCountedAt: subDays(new Date(), 1),
        },
      });
    }
  }

  // ---- Staff & shifts --------------------------------------------------------
  const staffTemplates = [
    { name: "Alicia Ford", title: "Shift Lead", rate: 19.5, type: "FULL_TIME" as const },
    { name: "Brian Cole", title: "Cashier", rate: 14.0, type: "PART_TIME" as const },
    { name: "Dana Whitfield Jr.", title: "Assistant Manager", rate: 22.0, type: "FULL_TIME" as const },
    { name: "Emily Sanchez", title: "Cashier", rate: 14.5, type: "PART_TIME" as const },
    { name: "Frank Nunez", title: "Overnight Attendant", rate: 16.0, type: "FULL_TIME" as const },
  ];

  for (const loc of locations) {
    const members = await Promise.all(
      staffTemplates.map((tpl) =>
        prisma.staffMember.create({
          data: {
            locationId: loc.id,
            name: `${tpl.name}`,
            title: tpl.title,
            hourlyRate: tpl.rate,
            employmentType: tpl.type,
            hiredAt: subDays(new Date(), 300),
          },
        })
      )
    );

    // schedule this week + last week for labor cost history
    for (let dayOffset = -7; dayOffset < 7; dayOffset++) {
      const day = addDays(new Date(), dayOffset);
      for (const [idx, member] of members.entries()) {
        if ((dayOffset + idx) % 3 === 0) continue; // day off rotation
        const start = new Date(day);
        start.setHours(idx % 2 === 0 ? 6 : 14, 0, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + 8);
        await prisma.shift.create({
          data: {
            locationId: loc.id,
            staffMemberId: member.id,
            startTime: start,
            endTime: end,
            position: member.title ?? undefined,
            status: dayOffset < 0 ? "COMPLETED" : "SCHEDULED",
          },
        });
      }
    }

    await prisma.timeOffRequest.create({
      data: {
        staffMemberId: members[1].id,
        startDate: addDays(new Date(), 5),
        endDate: addDays(new Date(), 7),
        reason: "Family event",
        status: "PENDING",
      },
    });
  }

  // ---- Revenue ----------------------------------------------------------------
  for (const loc of locations) {
    const base = loc.type === "TRUCK_STOP" ? 9500 : loc.type === "GROCERY_STORE" ? 6200 : 4100;
    for (let dayOffset = -28; dayOffset <= 0; dayOffset++) {
      const day = subDays(new Date(), -dayOffset);
      const weekday = day.getDay();
      const weekendBoost = weekday === 5 || weekday === 6 ? 1.18 : 1.0;
      const noise = 0.85 + (Math.abs((dayOffset * 37) % 23) / 23) * 0.3;
      await prisma.revenueEntry.create({
        data: {
          locationId: loc.id,
          date: day,
          grossRevenue: Math.round(base * weekendBoost * noise * 100) / 100,
          transactionCount: Math.round((base * weekendBoost * noise) / 18),
          source: "MANUAL",
        },
      });
    }
  }

  // ---- Compliance ---------------------------------------------------------------
  const complianceTemplates = [
    { title: "Fire Extinguisher Inspection", category: "Safety", frequency: "MONTHLY" as const, days: 4 },
    { title: "Fuel Tank Leak Detection Check", category: "Fuel", frequency: "MONTHLY" as const, days: -2 },
    { title: "Walk-in Cooler Temperature Log", category: "Food Safety", frequency: "DAILY" as const, days: 0 },
    { title: "State Health Department Self-Audit", category: "Health", frequency: "QUARTERLY" as const, days: 12 },
    { title: "Underground Storage Tank Certification", category: "Environmental", frequency: "ANNUAL" as const, days: 45 },
  ];
  for (const loc of locations) {
    for (const tpl of complianceTemplates) {
      const dueDate = addDays(new Date(), tpl.days);
      const status = tpl.days < 0 ? "OVERDUE" : tpl.days <= 7 ? "DUE_SOON" : "UPCOMING";
      await prisma.complianceItem.create({
        data: {
          accountId: account.id,
          locationId: loc.id,
          title: tpl.title,
          category: tpl.category,
          frequency: tpl.frequency,
          nextDueDate: dueDate,
          status,
        },
      });
    }
  }

  // ---- Tasks ------------------------------------------------------------------
  await prisma.task.create({
    data: {
      locationId: northgate.id,
      type: "MAINTENANCE",
      title: "Pump 3 card reader offline",
      description: "Customers reporting card reader on pump 3 is not accepting chip cards.",
      priority: "HIGH",
      status: "OPEN",
      createdById: manager.id,
    },
  });
  await prisma.task.create({
    data: {
      locationId: northgate.id,
      type: "CHECKLIST",
      title: "Opening Checklist - 7/15",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      createdById: manager.id,
      checklistItems: {
        create: [
          { label: "Unlock doors & disable alarm", isDone: true, sortOrder: 0 },
          { label: "Turn on fuel pumps", isDone: true, sortOrder: 1 },
          { label: "Count register drawer", isDone: false, sortOrder: 2 },
          { label: "Check walk-in cooler temp", isDone: false, sortOrder: 3 },
        ],
      },
    },
  });
  await prisma.task.create({
    data: {
      locationId: riverside.id,
      type: "INCIDENT",
      title: "Slip and fall near entrance",
      description: "Customer slipped near wet floor sign at 2:15pm. No injury reported, incident logged per policy.",
      priority: "URGENT",
      status: "OPEN",
      createdById: owner.id,
      metadata: { involvedParty: "Customer", location: "Front entrance" },
    },
  });

  // ---- Alerts ------------------------------------------------------------------
  await prisma.alert.createMany({
    data: [
      {
        locationId: northgate.id,
        category: "INVENTORY",
        severity: "WARNING",
        title: "4 items below reorder point",
        message: "Diesel Exhaust Fluid, Snickers King Size, and 2 others are below their reorder point.",
      },
      {
        locationId: northgate.id,
        category: "COMPLIANCE",
        severity: "CRITICAL",
        title: "Fuel Tank Leak Detection Check overdue",
        message: "This item was due 2 days ago.",
      },
      {
        locationId: riverside.id,
        category: "TASK",
        severity: "CRITICAL",
        title: "Urgent incident reported",
        message: "Slip and fall near entrance needs review.",
      },
      {
        locationId: downtown.id,
        category: "STAFFING",
        severity: "INFO",
        title: "Time-off request pending",
        message: "Brian Cole requested time off starting in 5 days.",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Login as owner: owner@lonestargroup.com / OpsFlow2026!");
  console.log("Login as manager: manager.northgate@lonestargroup.com / OpsFlow2026!");
  console.log("Login as platform admin: admin@opsflow.ai / OpsFlow2026!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
