import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const nbs = await prisma.source.upsert({
    where: { id: "src-nbs" },
    update: {},
    create: {
      id: "src-nbs",
      name: "NBS Price Watch",
      kind: "indicator",
      trustWeight: 0.9,
    },
  })
  const fx = await prisma.source.upsert({
    where: { id: "src-fx" },
    update: {},
    create: {
      id: "src-fx",
      name: "FX rates feed",
      kind: "indicator",
      trustWeight: 0.8,
    },
  })
  await prisma.source.upsert({
    where: { id: "src-gdelt" },
    update: {},
    create: {
      id: "src-gdelt",
      name: "GDELT DOC",
      kind: "gdelt",
      trustWeight: 0.6,
    },
  })
  await prisma.source.upsert({
    where: { id: "src-radio" },
    update: {},
    create: {
      id: "src-radio",
      name: "Radio transcripts",
      kind: "radio",
      trustWeight: 0.74,
    },
  })

  const series = [
    {
      key: "food.rice_50kg.national",
      unit: "NGN/50kg",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "food.beans_50kg.national",
      unit: "NGN/50kg",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "food.garri_50kg.national",
      unit: "NGN/50kg",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "food.oil_5l.national",
      unit: "NGN/5L",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "food.tomatoes_basket.national",
      unit: "NGN/basket",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "fuel.pms.national",
      unit: "NGN/litre",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "fuel.ago.national",
      unit: "NGN/litre",
      frequency: "monthly",
      sourceId: nbs.id,
    },
    {
      key: "fx.ngn_usd.official",
      unit: "NGN/USD",
      frequency: "daily",
      sourceId: fx.id,
    },
  ]
  for (const s of series) {
    await prisma.indicatorSeries.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }

  // Jun–Sep 2026 monthly points (fictional seed for the demo window)
  const rice = await prisma.indicatorSeries.findUniqueOrThrow({
    where: { key: "food.rice_50kg.national" },
  })
  const points = [
    { observedAt: new Date("2026-06-01"), value: 88000 },
    { observedAt: new Date("2026-07-01"), value: 90500 },
    { observedAt: new Date("2026-08-01"), value: 95000 },
    { observedAt: new Date("2026-09-01"), value: 99200 },
  ]
  for (const p of points) {
    await prisma.indicatorPoint.create({ data: { seriesId: rice.id, ...p } })
  }

  const b1 = await prisma.business.create({
    data: {
      name: "Mama Put Restaurant (demo)",
      vertical: "food_buyer",
      region: "Surulere, Lagos",
    },
  })
  await prisma.exposure.create({
    data: {
      businessId: b1.id,
      data: JSON.stringify({
        items: [
          {
            seriesKey: "food.rice_50kg.national",
            weeklyQty: 2,
            unit: "50kg",
            storableWeeks: 4,
            perishable: false,
          },
          {
            seriesKey: "food.beans_50kg.national",
            weeklyQty: 1,
            unit: "50kg",
            storableWeeks: 4,
            perishable: false,
          },
        ],
      }),
    },
  })
  const b2 = await prisma.business.create({
    data: {
      name: "Abuja Grocery Delivery (demo)",
      vertical: "food_buyer",
      region: "Wuse Market, Abuja",
    },
  })
  await prisma.exposure.create({
    data: {
      businessId: b2.id,
      data: JSON.stringify({
        items: [
          {
            seriesKey: "food.tomatoes_basket.national",
            weeklyQty: 10,
            unit: "basket",
            storableWeeks: 0,
            perishable: true,
          },
          {
            seriesKey: "food.garri_50kg.national",
            weeklyQty: 3,
            unit: "50kg",
            storableWeeks: 6,
            perishable: false,
          },
        ],
      }),
    },
  })

  console.log("seeded", { businesses: 2, series: series.length })
}

await main()
await prisma.$disconnect()
