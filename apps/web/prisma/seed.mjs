import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_CASHIER_USERNAME = "system-cashier";
const RESET_SEED_DATA = process.env.COFFEE_POS_RESET_SEED_DATA === "1";

const menuItems = [
  menuItem("Sữa chua", "sua-chua-nha-dam-hat-sen", "Sữa Chua Nha Đam Hạt Sen", 39000),
  menuItem("Sữa chua", "sua-chua-viet-quat-bac-ha", "Sữa Chua Việt Quất Bạc Hà", 39000),
  menuItem("Sữa chua", "sua-chua-dau", "Sữa Chua Dâu", 39000),
  menuItem("Sữa chua", "sua-chua-dao", "Sữa Chua Đào", 39000),
  menuItem("Sữa chua", "sua-chua-xoai", "Sữa Chua Xoài", 39000),
  menuItem("Trà trái cây", "tra-dao-atiso", "Trà Đào Atiso", 39000),
  menuItem("Trà trái cây", "tra-dau-oi-hong", "Trà Dâu Ổi Hồng", 39000),
  menuItem("Trà trái cây", "tra-nhan-que-hoa", "Trà Nhãn Quế Hoa", 39000),
  menuItem("Trà trái cây", "tra-oi-hoa-hong", "Trà Ổi Hoa Hồng", 39000),
  menuItem("Trà trái cây", "tra-vai-hoa-nhai", "Trà Vải Hoa Nhài", 39000),
  menuItem("Soda", "soda-dao", "Soda Đào", 35000),
  menuItem("Soda", "soda-dau", "Soda Dâu", 35000),
  menuItem("Soda", "soda-xoai", "Soda Xoài", 35000),
  menuItem("Soda", "soda-viet-quat", "Soda Việt Quất", 35000),
  menuItem("Cacao", "cacao-nong-da", "Cacao Nóng / Đá", 37000),
  menuItem("Cacao", "cacao-latte-kem-trung", "Cacao Latte Kem Trứng", 39000),
  menuItem("Cacao", "cacao-bac-ha", "Cacao Bạc Hà", 39000),
  menuItem("Trà sữa", "tra-sua-oolong-tran-chau", "Trà Sữa Oolong Trân Châu", 39000),
  menuItem("Trà sữa", "tra-sua-oolong-kem-trung", "Trà Sữa Oolong Kem Trứng", 39000),
  menuItem("Trà sữa", "tra-sua-gao-rang-hat-sen", "Trà Sữa Gạo Rang Hạt Sen", 39000),
  menuItem("Cà phê", "ca-phe-den", "Cà Phê Đen", 25000),
  menuItem("Cà phê", "ca-phe-sua", "Cà Phê Sữa", 30000),
  menuItem("Cà phê", "americano", "Americano", 30000),
  menuItem("Cà phê", "ca-phe-kem-muoi", "Cà Phê Kem Muối", 35000),
  menuItem("Cà phê", "ca-phe-kem-trung", "Cà Phê Kem Trứng", 35000),
  menuItem("Cà phê", "bac-xiu", "Bạc Xỉu", 35000),
  menuItem("Cà phê", "ca-phe-sua-tuoi-hanh-nhan", "Cà Phê Sữa Tươi Hạnh Nhân", 39000),
  menuItem("Matcha", "matcha-latte", "Matcha Latte", 39000),
  menuItem("Matcha", "matcha-sua-yen-mach", "Matcha Sữa Yến Mạch", 47000),
  menuItem("Matcha", "matcha-cold-whisk", "Matcha Cold Whisk", 39000),
  menuItem("Bánh mì", "pate-cha-bong-pho-mai", "Pate Chà Bông Phô Mai", 17000),
  menuItem("Bánh mì", "xuc-xich-pho-mai", "Xúc Xích Phô Mai", 19000),
  menuItem("Bánh mì", "ga-cay-ngot-pho-mai", "Gà Cay Ngọt Phô Mai", 22000),
  menuItem("Bánh mì", "bo-pho-mai", "Bò Phô Mai", 25000)
];

const inventoryItems = [
  inventory("HU_SUA_CHUA", "Hũ sữa chua", "hũ", null, 1, 0, "Nhập giá theo 1 hũ nếu mua lẻ; hoặc nhập giá thùng và quy đổi số hũ."),
  inventory("SUA_TUOI", "Sữa tươi", "ml", 37000, 1000, 37, "Sữa Tươi Tiệt Trùng Vinamilk Không Đường 1L - 37.000đ/hộp, nguồn: phacheviet.com/ảnh người dùng."),
  inventory("SUA_DAC", "Sữa đặc", "ml", 68900, 1284, 53.66043613707165, "Sữa đặc Ngôi Sao Phương Nam nhãn xanh 1.284kg - 68.900đ/hộp, nguồn: MM Mega Market/ảnh người dùng. Tạm quy đổi g≈ml."),
  inventory("KBPC", "KBPC", "ml", 40000, 500, 80, "Rich Kem Béo Vị Sữa Icehot 500g - 40.000đ/hộp, nguồn: phacheviet.com/ảnh người dùng. Tạm quy đổi 500g ≈ 500ml."),
  inventory("WHIPPING_CREAM", "Whipping cream", "ml", 165000, 1000, 165, "Kem Whipping Cream Anchor 1L - 165.000đ/hộp, nguồn: phacheviet.com/ảnh người dùng."),
  inventory("PHO_MAI_CON_BO_CUOI", "Phô mai con bò cười", "miếng", 65500, 16, 4093.75, "Phô mai Con Bò Cười vị truyền thống hộp 224g (16 miếng) - 65.500đ/hộp, nguồn: bachhoaxanh.com/ảnh người dùng."),
  inventory("BOT_TRUNG_VANG", "Bột trứng vàng", "g", null, 1000, 0, "Dùng kem trứng."),
  inventory("MUOI", "Muối", "g", null, 1000, 0, "Có thể để giá rất thấp hoặc bỏ qua."),
  inventory("TAC", "Tắc", "quả", null, 1, 0, "Nhập giá trung bình 1 quả."),
  inventory("DA", "Đá", "g", null, 1000, 0, "Có thể nhập giá đá cây/túi theo gram."),
  inventory("NUOC_DUONG", "Nước đường", "ml", 33700, 1200, 28.083333333333332, "Nước đường tự nấu: đường Biên Hòa Pure 33.700đ/kg; 1kg đường + 650ml nước -> thu ~1.2L."),
  inventory("SIRO_VAI", "Siro vải", "ml", null, 750, 0, ""),
  inventory("SIRO_DAO", "Siro đào", "ml", null, 750, 0, ""),
  inventory("SIRO_DAU", "Siro dâu", "ml", null, 750, 0, ""),
  inventory("SIRO_XOAI", "Siro xoài", "ml", null, 750, 0, ""),
  inventory("SIRO_VIET_QUAT", "Siro việt quất", "ml", null, 750, 0, ""),
  inventory("SIRO_BAC_HA", "Siro bạc hà", "ml", null, 750, 0, ""),
  inventory("SIRO_HANH_NHAN", "Siro hạnh nhân", "ml", null, 750, 0, ""),
  inventory("SIRO_ATISO_HIBISCUS", "Siro atiso/hibiscus", "ml", null, 750, 0, ""),
  inventory("SIRO_OI_HONG", "Siro ổi hồng", "ml", null, 750, 0, ""),
  inventory("SIRO_QUE_HOA", "Siro quế hoa", "ml", null, 750, 0, ""),
  inventory("SIRO_HOA_HONG", "Siro hoa hồng", "ml", null, 750, 0, ""),
  inventory("SIRO_HOA_NHAI", "Siro hoa nhài", "ml", null, 750, 0, ""),
  inventory("MUT_DECOR_DAO", "Mứt decor đào", "ml", null, 1000, 0, ""),
  inventory("MUT_DECOR_DAU", "Mứt decor dâu", "ml", null, 1000, 0, ""),
  inventory("MUT_DECOR_XOAI", "Mứt decor xoài", "ml", null, 1000, 0, ""),
  inventory("MUT_DECOR_VIET_QUAT", "Mứt decor việt quất", "ml", null, 1000, 0, ""),
  inventory("THACH_NHA_DAM", "Thạch nha đam", "g", null, 1000, 0, ""),
  inventory("THACH_CU_NANG", "Thạch củ năng", "g", null, 1000, 0, ""),
  inventory("HAT_SEN", "Hạt sen", "g", null, 1000, 0, ""),
  inventory("DAO_MIENG", "Đào miếng", "g", null, 1000, 0, ""),
  inventory("NHAN", "Nhãn", "g", null, 1000, 0, ""),
  inventory("VAI", "Vải", "g", null, 1000, 0, ""),
  inventory("TRA_DEN_U", "Trà đen ủ", "ml", null, 1000, 0, "Có thể tính từ trà khô + nước; nhập giá vốn cốt trà/ml."),
  inventory("TRA_NHAI_U", "Trà nhài ủ", "ml", null, 1000, 0, "Có thể tính từ trà khô + nước; nhập giá vốn cốt trà/ml."),
  inventory("COT_CA_PHE", "Cốt cà phê", "ml", null, 1000, 0, "Tính từ cà phê bột sau khi pha; nhập giá vốn cốt/ml."),
  inventory("COT_TRA_OOLONG", "Cốt trà oolong", "ml", null, 1000, 0, "Cốt trà sữa hoặc cốt trà đã ủ."),
  inventory("COT_TRA_GAO_RANG", "Cốt trà gạo rang", "ml", null, 1000, 0, "Cốt trà sữa hoặc cốt trà đã ủ."),
  inventory("BOT_MATCHA", "Bột matcha", "g", 650000, 500, 1300, "Matcha Uji Nhật Bản Ceremonial Grade nguyên chất - 650.000đ/gói 500g, nguồn: phacheviet.com/ảnh người dùng."),
  inventory("MEIJI", "Meiji", "ml", 69000, 946, 72.93868921775899, "Sữa thanh trùng Meiji hộp 946ml - 69.000đ/hộp, nguồn: MM/Kidsplaza/ảnh người dùng."),
  inventory("SUA_OATSIDE", "Sữa Oatside", "ml", 55000, 1000, 55, "Sữa yến mạch OATSIDE Barista Oat Milk 1L - 55.000đ/hộp, nguồn: tropicana.vn/ảnh người dùng."),
  inventory("BOT_CACAO", "Bột cacao", "g", null, 1000, 0, ""),
  inventory("TRAN_CHAU", "Trân châu", "g", null, 1000, 0, ""),
  inventory("SODA", "Soda", "ml", null, 1000, 0, "Nếu dùng lon/chai 320ml thì nhập quy cách 320ml."),
  inventory("LY_NAP_ONG_HUT", "Ly + nắp + ống hút", "bộ", null, 1, 0, "Bao bì cho đồ uống."),
  inventory("BANH_MI", "Bánh mì", "ổ", null, 1, 0, ""),
  inventory("PATE", "Pate", "g", null, 1000, 0, ""),
  inventory("CHA_BONG", "Chà bông", "g", null, 1000, 0, ""),
  inventory("PHO_MAI_LAT", "Phô mai lát", "lát", null, 1, 0, ""),
  inventory("XUC_XICH", "Xúc xích", "cây", null, 1, 0, ""),
  inventory("GA_CAY_NGOT", "Gà cay ngọt", "g", null, 1000, 0, ""),
  inventory("NHAN_BO", "Nhân bò", "g", null, 1000, 0, ""),
  inventory("SOT_MAYO", "Sốt/mayo", "g", null, 1000, 0, ""),
  inventory("SOT_TIEU_DEN_BBQ", "Sốt tiêu đen/BBQ", "g", null, 1000, 0, ""),
  inventory("BO", "Bơ", "g", null, 1000, 0, ""),
  inventory("TUI_GIAY_BANH_MI", "Túi giấy bánh mì", "cái", null, 1, 0, ""),
  inventory("SIRO_NHAN", "Siro nhãn", "ml", null, 750, 0, ""),
  inventory("MACCHIATO", "Macchiato", "ml", 56800, 450, 126.22319324553257, "Macchiato mẻ mới cập nhật giá: 120ml KBPC + 160ml whipping + 160ml ST + 10ml SĐ + 2 miếng phô mai + ít muối; mẻ ~450ml."),
  inventory("DUONG_CAT_BIEN_HOA_PURE", "Đường cát Biên Hòa Pure", "g", 168500, 5000, 33.7, "Combo 5 Đường Túi Biên Hòa Pure 1kg/túi - 168.500đ/combo, nguồn: agrismart.com.vn/ảnh người dùng.")
];

async function main() {
  if (RESET_SEED_DATA) {
    await resetSeedData();
  }

  await prisma.user.upsert({
    where: { username: SYSTEM_CASHIER_USERNAME },
    create: {
      username: SYSTEM_CASHIER_USERNAME,
      displayName: "System Cashier",
      pinHash: "DISABLED_UNTIL_AUTH",
      role: "CASHIER",
      isActive: true
    },
    update: {
      displayName: "System Cashier",
      pinHash: "DISABLED_UNTIL_AUTH",
      role: "CASHIER",
      isActive: true
    }
  });

  const categoryByName = new Map();
  for (const [index, category] of getMenuCategories().entries()) {
    const savedCategory = await prisma.menuCategory.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        sortOrder: index + 1,
        isActive: true
      },
      update: {
        name: category.name,
        sortOrder: index + 1,
        isActive: true
      }
    });

    categoryByName.set(category.name, savedCategory);
  }

  for (const [index, item] of menuItems.entries()) {
    const category = categoryByName.get(item.categoryName);
    if (!category) throw new Error(`Missing category ${item.categoryName}`);

    const savedItem = await prisma.menuItem.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        categoryId: category.id,
        name: item.name,
        description: "",
        basePrice: BigInt(item.price),
        sortOrder: index + 1,
        isActive: true
      },
      update: {
        categoryId: category.id,
        name: item.name,
        description: "",
        basePrice: BigInt(item.price),
        sortOrder: index + 1,
        isActive: true
      }
    });

    await prisma.menuItemVariant.upsert({
      where: { slug: `${item.slug}-ly` },
      create: {
        slug: `${item.slug}-ly`,
        itemId: savedItem.id,
        name: "Ly",
        price: BigInt(item.price),
        sortOrder: 1,
        isActive: true
      },
      update: {
        itemId: savedItem.id,
        name: "Ly",
        price: BigInt(item.price),
        sortOrder: 1,
        isActive: true
      }
    });
  }

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

async function resetSeedData() {
  await prisma.$transaction(
    async (tx) => {
      await tx.payment.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.order.deleteMany();
      await tx.menuItemVariant.deleteMany();
      await tx.menuItem.deleteMany();
      await tx.menuCategory.deleteMany();
      await tx.inventoryInvoiceAttachment.deleteMany();
      await tx.inventoryPurchaseRecord.deleteMany();
      await tx.inventoryStockMovement.deleteMany();
      await tx.inventoryImportRow.updateMany({
        where: { matchedInventoryItemId: { not: null } },
        data: { matchedInventoryItemId: null }
      });
      await tx.inventoryItem.deleteMany();
    },
    { timeout: 30_000 }
  );
}

function getMenuCategories() {
  const seen = new Set();
  return menuItems
    .map((item) => ({ name: item.categoryName, slug: slugifyVi(item.categoryName) }))
    .filter((category) => {
      if (seen.has(category.slug)) return false;
      seen.add(category.slug);
      return true;
    });
}

function menuItem(categoryName, slug, name, price) {
  return {
    categoryName,
    slug,
    name,
    price
  };
}

function inventory(code, name, unit, purchasePriceVnd, conversionQuantity, unitCostVnd, sourceNote) {
  return {
    code,
    name,
    unit,
    currentQuantity: "0.000",
    lowStockThreshold: "0.000",
    note: buildInventoryNote(purchasePriceVnd, conversionQuantity, unitCostVnd, unit, sourceNote)
  };
}

function buildInventoryNote(purchasePriceVnd, conversionQuantity, unitCostVnd, unit, sourceNote) {
  const priceNote =
    purchasePriceVnd === null
      ? "Latest purchase price pending."
      : `Latest purchase price ${purchasePriceVnd} VND / ${conversionQuantity} ${unit}; unit cost ${roundUnitCost(unitCostVnd)} VND/${unit}.`;

  return [priceNote, sourceNote].filter(Boolean).join(" ");
}

function roundUnitCost(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function slugifyVi(value) {
  return value
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
