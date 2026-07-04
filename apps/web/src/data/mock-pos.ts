import type { BarTicket, MenuCategory, MenuItem, RecentOrder } from "@/types/pos";

export const menuCategories: MenuCategory[] = [
  { id: "all", name: "Tất cả" },
  { id: "yogurt", name: "Sữa chua" },
  { id: "soda", name: "Soda" },
  { id: "frappe", name: "Đá xay" },
  { id: "coffee", name: "Café" },
  { id: "matcha", name: "Matcha" }
];

export const menuItems: MenuItem[] = [
  menuItem("yogurt-house", "yogurt", "Sữa Chua Nhà Làm", "House yogurt, honey", "yogurt", 39000),
  menuItem("yogurt-mango", "yogurt", "Sữa Chua Xoài Chanh Dây", "Mango & passion fruit yogurt", "yogurt", 49000),
  menuItem("yogurt-mulberry", "yogurt", "Sữa Chua Dâu Tằm Đà Lạt", "Mulberry yogurt", "yogurt", 49000),
  menuItem("yogurt-raspberry", "yogurt", "Sữa Chua Phúc Bồn Tử", "Raspberry yogurt", "yogurt", 55000),
  menuItem("yogurt-lychee", "yogurt", "Sữa Chua Vải Hoa Hồng", "Lychee rose yogurt", "yogurt", 55000),

  menuItem("yuzu-soda", "soda", "Yuzu Lemon Soda", "Yuzu, chanh vàng, soda", "soda", 49000),
  menuItem("passion-vinegar-soda", "soda", "Passion Vinegar Soda", "Chanh dây, vinegar, soda", "soda", 49000),
  menuItem("pineapple-mint-soda", "soda", "Pineapple Mint Soda", "Thơm, bạc hà, soda", "soda", 49000),
  menuItem("lychee-rose-soda", "soda", "Lychee Rose Soda", "Vải, hoa hồng, soda", "soda", 55000),
  menuItem("berry-hibiscus-soda", "soda", "Berry Hibiscus Soda", "Berry, hibiscus, soda", "soda", 55000),

  menuItem("cookies-cream-frappe", "frappe", "Cookies Cream Đá Xay", "Cookies, kem sữa, đá xay", "frappe", 59000),
  menuItem("cacao-frappe", "frappe", "Cacao Đá Xay", "Cacao, sữa, đá xay", "frappe", 59000),
  menuItem("caramel-coffee-frappe", "frappe", "Caramel Coffee Frappe", "Cà phê, caramel, kem", "frappe", 65000),
  menuItem("matcha-cream-frappe", "frappe", "Matcha Cream Đá Xay", "Matcha, kem sữa, đá xay", "frappe", 65000),
  menuItem("mango-yogurt-frappe", "frappe", "Mango Yogurt Frappe", "Xoài, sữa chua, đá xay", "frappe", 65000),

  menuItem("espresso", "coffee", "Espresso", "Shot espresso đậm vị", "coffee", 35000),
  menuItem("americano", "coffee", "Americano", "Cà phê đen, hậu vị gọn", "coffee", 39000),
  menuItem("latte", "coffee", "Latte", "Espresso, sữa nóng, foam mịn", "coffee", 49000),
  menuItem("cappuccino", "coffee", "Cappuccino", "Foam dày, espresso cân bằng", "coffee", 49000),
  menuItem("bac-xiu", "coffee", "Bạc Xỉu Espresso", "Sữa, espresso, vị ngọt nhẹ", "coffee", 45000),
  menuItem("salt-coffee", "coffee", "Cà Phê Muối", "Kem muối, cà phê", "coffee", 49000),
  menuItem("coconut-latte", "coffee", "Coconut Latte", "Latte dừa béo nhẹ", "coffee", 59000),

  menuItem("matcha-latte", "matcha", "Matcha Latte", "Matcha thơm, sữa tươi", "matcha", 55000),
  menuItem("iced-matcha-latte", "matcha", "Iced Matcha Latte", "Matcha sữa đá", "matcha", 55000),
  menuItem("strawberry-matcha", "matcha", "Strawberry Matcha Latte", "Dâu, matcha, sữa", "matcha", 65000),
  menuItem("dirty-matcha", "matcha", "Dirty Matcha", "Matcha, espresso, sữa", "matcha", 69000),
  menuItem("matcha-yuzu", "matcha", "Matcha Yuzu Sparkling", "Matcha, yuzu, soda", "matcha", 65000)
];

export const barQueue: BarTicket[] = [
  {
    id: "bar-1",
    orderNo: "T-1027",
    type: "TAKEAWAY",
    status: "PREPARING",
    age: "4 phút",
    items: [
      { name: "Latte", variant: "Ly", modifiers: ["50% đường", "Thêm shot"], status: "Brewing" },
      { name: "Lychee Rose Soda", variant: "Ly", modifiers: ["Ít đá"], status: "Queued" }
    ]
  },
  {
    id: "bar-2",
    orderNo: "D-15",
    type: "DINE_IN",
    status: "READY",
    age: "7 phút",
    items: [{ name: "Matcha Latte", variant: "Ly", modifiers: ["70% đường"], status: "Ready" }]
  }
];

export const recentOrders: RecentOrder[] = [
  { id: "1", orderNo: "T-1028", customer: "Mang đi", status: "SENT", paymentStatus: "PAID", total: 98000, createdAt: "09:42" },
  { id: "2", orderNo: "D-14", customer: "Bàn 04", status: "READY", paymentStatus: "UNPAID", total: 169000, createdAt: "09:35" },
  { id: "3", orderNo: "T-1026", customer: "Mang đi", status: "CLOSED", paymentStatus: "PAID", total: 114000, createdAt: "09:18" }
];

function menuItem(id: string, categoryId: string, name: string, description: string, image: string, price: number): MenuItem {
  return {
    id,
    categoryId,
    name,
    description,
    image,
    tags: [categoryId],
    variants: [{ id: `${id}-cup`, name: "Ly", price }]
  };
}
