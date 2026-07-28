import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_CASHIER_USERNAME = "system-cashier";
const DEFAULT_OWNER_USERNAME = process.env.COFFEE_POS_OWNER_USERNAME ?? "admin";
const DEFAULT_OWNER_PIN = process.env.COFFEE_POS_OWNER_PIN ?? "admin";
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

const starterRecipes = [
  ["sua-chua-nha-dam-hat-sen", "Shaker: 1 HSC + 40ml sữa tươi + 20ml sữa đặc + 10ml siro vải + 20ml KBPC + 1 tắc + đá. Hoàn thiện: topping hạt sen và thạch nha đam.", [["HU_SUA_CHUA", 1, "hũ"], ["SUA_TUOI", 40, "ml"], ["SUA_DAC", 20, "ml"], ["SIRO_VAI", 10, "ml"], ["KBPC", 20, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["HAT_SEN", 20, "g"], ["THACH_NHA_DAM", 70, "g"]]],
  ["sua-chua-dao", "Shaker: 1 HSC + 40ml sữa tươi + 15ml siro đào + 15ml sữa đặc + 20ml KBPC + 1 tắc + đá. Hoàn thiện: mứt decor và thạch củ năng.", [["HU_SUA_CHUA", 1, "hũ"], ["SUA_TUOI", 40, "ml"], ["SIRO_DAO", 15, "ml"], ["SUA_DAC", 15, "ml"], ["KBPC", 20, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["MUT_DECOR_DAO", 15, "ml"], ["THACH_CU_NANG", 60, "g"]]],
  ["sua-chua-dau", "Shaker: 1 HSC + 40ml sữa tươi + 15ml siro dâu + 15ml sữa đặc + 20ml KBPC + 1 tắc + đá. Hoàn thiện: mứt decor và thạch củ năng.", [["HU_SUA_CHUA", 1, "hũ"], ["SUA_TUOI", 40, "ml"], ["SIRO_DAU", 15, "ml"], ["SUA_DAC", 15, "ml"], ["KBPC", 20, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["MUT_DECOR_DAU", 15, "ml"], ["THACH_CU_NANG", 60, "g"]]],
  ["sua-chua-xoai", "Shaker: 1 HSC + 40ml sữa tươi + 15ml siro xoài + 15ml sữa đặc + 20ml KBPC + 1 tắc + đá. Hoàn thiện: mứt decor và thạch củ năng.", [["HU_SUA_CHUA", 1, "hũ"], ["SUA_TUOI", 40, "ml"], ["SIRO_XOAI", 15, "ml"], ["SUA_DAC", 15, "ml"], ["KBPC", 20, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["MUT_DECOR_XOAI", 15, "ml"], ["THACH_CU_NANG", 60, "g"]]],
  ["sua-chua-viet-quat-bac-ha", "Shaker: 1 HSC + 40ml sữa tươi + 15ml siro bạc hà + 15ml sữa đặc + 20ml KBPC + 1 tắc + đá. Hoàn thiện: mứt việt quất và thạch củ năng.", [["HU_SUA_CHUA", 1, "hũ"], ["SUA_TUOI", 40, "ml"], ["SIRO_BAC_HA", 15, "ml"], ["SUA_DAC", 15, "ml"], ["KBPC", 20, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["MUT_DECOR_VIET_QUAT", 15, "ml"], ["THACH_CU_NANG", 60, "g"]]],
  ["matcha-latte", "Rây 4g matcha, đánh tan với 40ml nước ấm. Ly: 80ml sữa tươi + 40ml Meiji + 10ml KBPC + 10ml nước đường + đá. Rót matcha lên, phủ macchiato.", [["BOT_MATCHA", 4, "g"], ["SUA_TUOI", 80, "ml"], ["MEIJI", 40, "ml"], ["KBPC", 10, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"], ["MACCHIATO", 45, "ml"]]],
  ["matcha-cold-whisk", "Rây 4g matcha, đánh với 40ml Meiji lạnh + 10ml KBPC lạnh khoảng 1 phút. Ly: 100ml sữa tươi + 10ml nước đường + đá, rót foam lên.", [["BOT_MATCHA", 4, "g"], ["MEIJI", 40, "ml"], ["KBPC", 10, "ml"], ["SUA_TUOI", 100, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"]]],
  ["matcha-sua-yen-mach", "Rây 4g matcha, đánh tan với 50ml nước ấm. Ly: 120ml sữa Oatside + 10ml nước đường + đá. Rót matcha lên, phủ macchiato.", [["BOT_MATCHA", 4, "g"], ["SUA_OATSIDE", 120, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"], ["MACCHIATO", 45, "ml"]]],
  ["ca-phe-den", "60ml cốt cà phê + 0-10ml nước đường + đá. Khuấy cà phê với đường nếu khách uống ngọt, thêm đá.", [["COT_CA_PHE", 60, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"]]],
  ["ca-phe-sua", "60ml cốt cà phê + 25ml sữa đặc + đá. Khuấy tan sữa đặc với cà phê, thêm đá.", [["COT_CA_PHE", 60, "ml"], ["SUA_DAC", 25, "ml"], ["DA", 180, "g"]]],
  ["americano", "60ml cốt cà phê + 100-120ml nước lọc + đá. Cho nước vào ly trước, rót cà phê lên, thêm đá.", [["COT_CA_PHE", 60, "ml"], ["DA", 180, "g"]]],
  ["ca-phe-kem-muoi", "60ml cốt cà phê + 20ml sữa đặc + đá + 40-50ml macchiato. Khuấy nền cà phê trước, phủ kem muối sau cùng.", [["COT_CA_PHE", 60, "ml"], ["SUA_DAC", 20, "ml"], ["DA", 180, "g"], ["MACCHIATO", 45, "ml"]]],
  ["ca-phe-kem-trung", "60ml cốt cà phê + 20ml sữa đặc + đá + kem trứng. Đánh kem trứng bông mềm, phủ sau cùng.", [["COT_CA_PHE", 60, "ml"], ["SUA_DAC", 20, "ml"], ["DA", 180, "g"], ["KBPC", 10, "ml"], ["WHIPPING_CREAM", 20, "ml"], ["SUA_TUOI", 10, "ml"], ["BOT_TRUNG_VANG", 3, "g"]]],
  ["bac-xiu", "25ml sữa đặc + 100-120ml sữa tươi + 25-30ml cốt cà phê + đá. Cho sữa vào ly trước, thêm đá, rót cà phê lên mặt.", [["SUA_DAC", 25, "ml"], ["SUA_TUOI", 110, "ml"], ["COT_CA_PHE", 30, "ml"], ["DA", 180, "g"]]],
  ["ca-phe-sua-tuoi-hanh-nhan", "15ml syrup hạnh nhân + 100ml sữa tươi + 10ml sữa đặc/nước đường + 40ml cốt cà phê + đá. Rót cà phê lên trên.", [["SIRO_HANH_NHAN", 15, "ml"], ["SUA_TUOI", 100, "ml"], ["SUA_DAC", 10, "ml"], ["COT_CA_PHE", 40, "ml"], ["DA", 180, "g"]]],
  ["tra-dao-atiso", "120ml trà đen + syrup đào + atiso/hibiscus + nước đường + tắc + đá. Lắc đều trong shaker, decor đào miếng.", [["TRA_DEN_U", 120, "ml"], ["SIRO_DAO", 15, "ml"], ["SIRO_ATISO_HIBISCUS", 10, "ml"], ["NUOC_DUONG", 10, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["DAO_MIENG", 30, "g"]]],
  ["tra-dau-oi-hong", "120ml trà đen + syrup dâu + syrup ổi hồng + nước đường + tắc + đá. Lắc đều, decor trái cây nếu có.", [["TRA_DEN_U", 120, "ml"], ["SIRO_DAU", 10, "ml"], ["SIRO_OI_HONG", 15, "ml"], ["NUOC_DUONG", 10, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"]]],
  ["tra-nhan-que-hoa", "120ml trà đen/trà nhài + syrup nhãn + syrup quế hoa + nước đường + tắc + đá. Lắc đều, decor nhãn.", [["TRA_DEN_U", 120, "ml"], ["SIRO_NHAN", 15, "ml"], ["SIRO_QUE_HOA", 10, "ml"], ["NUOC_DUONG", 10, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["NHAN", 30, "g"]]],
  ["tra-oi-hoa-hong", "120ml trà đen + syrup ổi hồng + syrup hoa hồng + nước đường + tắc + đá. Lắc đều, decor lát ổi/hoa khô nếu có.", [["TRA_DEN_U", 120, "ml"], ["SIRO_OI_HONG", 15, "ml"], ["SIRO_HOA_HONG", 10, "ml"], ["NUOC_DUONG", 10, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"]]],
  ["tra-vai-hoa-nhai", "120ml trà nhài + syrup vải + hương/syrup hoa nhài + nước đường + tắc + đá. Lắc đều, decor vải.", [["TRA_NHAI_U", 120, "ml"], ["SIRO_VAI", 15, "ml"], ["SIRO_HOA_NHAI", 10, "ml"], ["NUOC_DUONG", 10, "ml"], ["TAC", 1, "quả"], ["DA", 180, "g"], ["VAI", 30, "g"]]],
  ["soda-dao", "15ml syrup đào + 15ml mứt decor + 15ml nước đường + đá 2/3 ly + soda châm đầy. Khuấy nhẹ.", [["SIRO_DAO", 15, "ml"], ["MUT_DECOR_DAO", 15, "ml"], ["NUOC_DUONG", 15, "ml"], ["DA", 180, "g"], ["SODA", 180, "ml"]]],
  ["soda-dau", "15ml syrup dâu + 15ml mứt decor + 15ml nước đường + đá 2/3 ly + soda châm đầy. Không lắc sau khi cho soda.", [["SIRO_DAU", 15, "ml"], ["MUT_DECOR_DAU", 15, "ml"], ["NUOC_DUONG", 15, "ml"], ["DA", 180, "g"], ["SODA", 180, "ml"]]],
  ["soda-xoai", "15ml syrup xoài + 15ml mứt decor + 15ml nước đường + đá 2/3 ly + soda châm đầy. Decor trái cây đúng vị nếu có.", [["SIRO_XOAI", 15, "ml"], ["MUT_DECOR_XOAI", 15, "ml"], ["NUOC_DUONG", 15, "ml"], ["DA", 180, "g"], ["SODA", 180, "ml"]]],
  ["soda-viet-quat", "15ml syrup việt quất + 15ml mứt decor + 15ml nước đường + đá 2/3 ly + soda châm đầy. Khuấy nhẹ từ dưới lên.", [["SIRO_VIET_QUAT", 15, "ml"], ["MUT_DECOR_VIET_QUAT", 15, "ml"], ["NUOC_DUONG", 15, "ml"], ["DA", 180, "g"], ["SODA", 180, "ml"]]],
  ["cacao-nong-da", "12-15g bột cacao + 30ml nước nóng + 20ml sữa đặc + 120ml sữa tươi + đá nếu uống lạnh. Đánh tan cacao trước.", [["BOT_CACAO", 15, "g"], ["SUA_DAC", 20, "ml"], ["SUA_TUOI", 120, "ml"], ["DA", 160, "g"]]],
  ["cacao-latte-kem-trung", "12-15g cacao + 30ml nước nóng + 20ml sữa đặc + 120ml sữa tươi + đá + kem trứng. Phủ kem trứng lên mặt.", [["BOT_CACAO", 15, "g"], ["SUA_DAC", 20, "ml"], ["SUA_TUOI", 120, "ml"], ["DA", 160, "g"], ["KBPC", 10, "ml"], ["WHIPPING_CREAM", 20, "ml"], ["BOT_TRUNG_VANG", 3, "g"]]],
  ["cacao-bac-ha", "12-15g cacao + 30ml nước nóng + 20ml sữa đặc + 120ml sữa tươi + 10ml syrup bạc hà + đá. Dùng bạc hà vừa phải.", [["BOT_CACAO", 15, "g"], ["SUA_DAC", 20, "ml"], ["SUA_TUOI", 120, "ml"], ["SIRO_BAC_HA", 10, "ml"], ["DA", 160, "g"]]],
  ["tra-sua-oolong-tran-chau", "120ml cốt trà oolong + 60ml sữa tươi + 20ml sữa đặc + 20ml KBPC + 10ml nước đường + đá. Cho 40g trân châu vào đáy ly.", [["COT_TRA_OOLONG", 120, "ml"], ["SUA_TUOI", 60, "ml"], ["SUA_DAC", 20, "ml"], ["KBPC", 20, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"], ["TRAN_CHAU", 40, "g"]]],
  ["tra-sua-oolong-kem-trung", "120ml cốt trà oolong + 60ml sữa tươi + 20ml sữa đặc + 20ml KBPC + 10ml nước đường + đá. Phủ kem trứng lên mặt.", [["COT_TRA_OOLONG", 120, "ml"], ["SUA_TUOI", 60, "ml"], ["SUA_DAC", 20, "ml"], ["KBPC", 20, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"], ["BOT_TRUNG_VANG", 3, "g"]]],
  ["tra-sua-gao-rang-hat-sen", "120ml cốt trà gạo rang + 60ml sữa tươi + 20ml sữa đặc + 20ml KBPC + 10ml nước đường + đá. Cho hạt sen vào ly.", [["COT_TRA_GAO_RANG", 120, "ml"], ["SUA_TUOI", 60, "ml"], ["SUA_DAC", 20, "ml"], ["KBPC", 20, "ml"], ["NUOC_DUONG", 10, "ml"], ["DA", 180, "g"], ["HAT_SEN", 20, "g"]]],
  ["pate-cha-bong-pho-mai", "Nhân chính: pate + chà bông + phô mai. Cần chốt lại định lượng gram thực tế sau khi test vận hành.", [["BANH_MI", 1, "ổ"], ["PATE", 25, "g"], ["CHA_BONG", 12, "g"], ["PHO_MAI_LAT", 1, "lát"], ["TUI_GIAY_BANH_MI", 1, "cái"]]],
  ["xuc-xich-pho-mai", "Nhân chính: xúc xích + phô mai. Cần chốt lại định lượng thực tế sau khi test vận hành.", [["BANH_MI", 1, "ổ"], ["XUC_XICH", 1, "cây"], ["PHO_MAI_LAT", 1, "lát"], ["SOT_MAYO", 10, "g"], ["TUI_GIAY_BANH_MI", 1, "cái"]]],
  ["ga-cay-ngot-pho-mai", "Nhân chính: gà cay ngọt + phô mai. Cần chốt lại định lượng gram thực tế sau khi test vận hành.", [["BANH_MI", 1, "ổ"], ["GA_CAY_NGOT", 45, "g"], ["PHO_MAI_LAT", 1, "lát"], ["SOT_MAYO", 10, "g"], ["TUI_GIAY_BANH_MI", 1, "cái"]]],
  ["bo-pho-mai", "Nhân chính: nhân bò + phô mai. Cần chốt lại định lượng gram thực tế sau khi test vận hành.", [["BANH_MI", 1, "ổ"], ["NHAN_BO", 45, "g"], ["PHO_MAI_LAT", 1, "lát"], ["SOT_TIEU_DEN_BBQ", 10, "g"], ["TUI_GIAY_BANH_MI", 1, "cái"]]]
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

  await prisma.user.upsert({
    where: { username: DEFAULT_OWNER_USERNAME },
    create: {
      username: DEFAULT_OWNER_USERNAME,
      displayName: "Owner",
      pinHash: hashStaffPin(DEFAULT_OWNER_PIN),
      role: "OWNER",
      isActive: true
    },
    update: {
      displayName: "Owner",
      pinHash: hashStaffPin(DEFAULT_OWNER_PIN),
      role: "OWNER",
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

  await seedProductRecipes();
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
      await tx.productCostSnapshot.deleteMany();
      await tx.productRecipeIngredient.deleteMany();
      await tx.productRecipe.deleteMany();
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

async function seedProductRecipes() {
  const [menuRows, inventoryRows] = await Promise.all([
    prisma.menuItem.findMany({
      select: {
        id: true,
        slug: true
      }
    }),
    prisma.inventoryItem.findMany({
      select: {
        id: true,
        code: true
      }
    })
  ]);
  const menuItemBySlug = new Map(menuRows.map((item) => [item.slug, item]));
  const inventoryItemByCode = new Map(inventoryRows.map((item) => [item.code, item]));

  for (const [menuItemSlug, note, ingredients] of starterRecipes) {
    const menuItem = menuItemBySlug.get(menuItemSlug);
    if (!menuItem) continue;

    const targetKey = `MENU_ITEM:${menuItem.id}`;
    const existingRecipe = await prisma.productRecipe.findUnique({
      where: { targetKey },
      select: { id: true }
    });
    if (existingRecipe) continue;

    const savedRecipe = await prisma.productRecipe.create({
      data: {
        targetType: "MENU_ITEM",
        targetKey,
        menuItemId: menuItem.id,
        packagingCostVnd: BigInt(0),
        note
      }
    });

    const ingredientRows = ingredients
      .map(([code, quantity, unit], index) => {
        const inventoryItem = inventoryItemByCode.get(code);
        if (!inventoryItem) return null;
        return {
          recipeId: savedRecipe.id,
          inventoryItemId: inventoryItem.id,
          quantity: quantity.toString(),
          unit,
          wastePercent: "0",
          sortOrder: index
        };
      })
      .filter(Boolean);

    if (ingredientRows.length) {
      await prisma.productRecipeIngredient.createMany({
        data: ingredientRows
      });
    }
  }
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

function hashStaffPin(pin) {
  const params = { N: 16_384, r: 8, p: 1 };
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(pin, salt, 32, params).toString("base64url");
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt}$${key}`;
}
