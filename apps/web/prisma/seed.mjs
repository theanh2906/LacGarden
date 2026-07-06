import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const inventoryItems = [
  {
    code: "BEAN-ROBUSTA",
    name: "Hat ca phe Robusta",
    unit: "kg",
    currentQuantity: "8.500",
    lowStockThreshold: "2.000",
    note: "Main espresso and Vietnamese coffee bean stock"
  },
  {
    code: "BEAN-ARABICA",
    name: "Hat ca phe Arabica",
    unit: "kg",
    currentQuantity: "4.000",
    lowStockThreshold: "1.500",
    note: "Premium coffee bean stock"
  },
  {
    code: "MILK-FRESH",
    name: "Sua tuoi",
    unit: "liter",
    currentQuantity: "18.000",
    lowStockThreshold: "6.000",
    note: "Fresh milk for coffee, cacao, and matcha"
  },
  {
    code: "MILK-CONDENSED",
    name: "Sua dac",
    unit: "can",
    currentQuantity: "24.000",
    lowStockThreshold: "8.000",
    note: "Condensed milk for Vietnamese coffee"
  },
  {
    code: "MATCHA-POWDER",
    name: "Bot matcha",
    unit: "kg",
    currentQuantity: "1.200",
    lowStockThreshold: "0.500",
    note: "Matcha drinks"
  },
  {
    code: "CACAO-POWDER",
    name: "Bot cacao",
    unit: "kg",
    currentQuantity: "1.800",
    lowStockThreshold: "0.700",
    note: "Cacao and chocolate drinks"
  },
  {
    code: "SYRUP-PEACH",
    name: "Syrup dao",
    unit: "bottle",
    currentQuantity: "6.000",
    lowStockThreshold: "2.000",
    note: "Fruit tea and soda"
  },
  {
    code: "TEA-OOLONG",
    name: "Tra oolong",
    unit: "kg",
    currentQuantity: "2.400",
    lowStockThreshold: "0.800",
    note: "Milk tea and fruit tea base"
  },
  {
    code: "CUP-16OZ",
    name: "Ly giay 16oz",
    unit: "pack",
    currentQuantity: "12.000",
    lowStockThreshold: "4.000",
    note: "Takeaway cups"
  },
  {
    code: "PEARL-BOBA",
    name: "Tran chau",
    unit: "kg",
    currentQuantity: "3.500",
    lowStockThreshold: "1.000",
    note: "Milk tea topping"
  }
];

async function main() {
  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { code: item.code },
      create: item,
      update: {
        name: item.name,
        unit: item.unit,
        lowStockThreshold: item.lowStockThreshold,
        note: item.note,
        isActive: true
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
