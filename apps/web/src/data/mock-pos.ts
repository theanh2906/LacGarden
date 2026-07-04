import type { BarTicket, MenuCategory, MenuItem, RecentOrder } from "@/types/pos";

export const menuCategories: MenuCategory[] = [
  { id: "all", name: "Tất cả" },
  { id: "yogurt", name: "Sữa chua" },
  { id: "fruit-tea", name: "Trà trái cây" },
  { id: "soda", name: "Soda" },
  { id: "milk-tea", name: "Trà sữa" },
  { id: "cacao", name: "Cacao" },
  { id: "coffee", name: "Café" },
  { id: "matcha", name: "Matcha" },
  { id: "bread", name: "Bánh mì" }
];

export const menuItems: MenuItem[] = [
  menuItem("yogurt-aloe-lotus", "yogurt", "Sữa Chua Nha Đam Hạt Sen", "Aloe Vera & Lotus Seed Yogurt", "yogurt", 39000),
  menuItem("yogurt-blueberry-mint", "yogurt", "Sữa Chua Việt Quất Bạc Hà", "Blueberry Mint Yogurt", "yogurt", 39000),
  menuItem("yogurt-fruit", "yogurt", "Sữa Chua: Dâu - Đào - Xoài", "Fruit Yogurt: Strawberry - Peach - Mango", "yogurt", 39000),

  menuItem("peach-artichoke-tea", "fruit-tea", "Trà Đào Atiso", "Peach & Hibiscus Tea", "fruittea", 39000),
  menuItem("strawberry-pink-guava-tea", "fruit-tea", "Trà Dâu Ổi Hồng", "Strawberry & Pink Guava Tea", "fruittea", 39000),
  menuItem("longan-osmanthus-tea", "fruit-tea", "Trà Nhãn Quế Hoa", "Longan & Osmanthus Flower Tea", "fruittea", 39000),
  menuItem("pink-guava-rose-tea", "fruit-tea", "Trà Ổi Hoa Hồng", "Pink Guava & Rose Tea", "fruittea", 39000),
  menuItem("lychee-jasmine-tea", "fruit-tea", "Trà Vải Hoa Nhài", "Lychee & Jasmine Flower Tea", "fruittea", 39000),

  menuItem("garden-soda", "soda", "Đào - Dâu - Xoài - Việt Quất", "Peach - Strawberry - Mango - Blueberry", "soda", 35000),

  menuItem("oolong-boba-milk-tea", "milk-tea", "Trà Sữa Olong Trân Châu", "Oolong Milk Tea Topping Boba", "milktea", 39000),
  menuItem("oolong-egg-cream-milk-tea", "milk-tea", "Trà Sữa Olong Kem Trứng", "Oolong Milk Tea Topping Egg Cream", "milktea", 39000),
  menuItem("roasted-rice-lotus-milk-tea", "milk-tea", "Trà Sữa Gạo Rang Hạt Sen", "Roasted Rice Milk Tea Topping Lotus Seed", "milktea", 39000),

  menuItem("hot-ice-cacao", "cacao", "Cacao Nóng / Đá", "Hot/Ice Choco", "cacao", 37000),
  menuItem("egg-cream-cacao-latte", "cacao", "Cacao Latte Kem Trứng", "Egg Cream Choco Latte", "cacao", 39000),
  menuItem("mint-cacao", "cacao", "Cacao Bạc Hà", "Choco Mint", "cacao", 39000),

  menuItem("ca-phe-den", "coffee", "Cà Phê Đen", "Iced Coffee", "coffee", 25000),
  menuItem("ca-phe-sua", "coffee", "Cà Phê Sữa", "Iced Coffee W/Condensed Milk", "coffee", 30000),
  menuItem("americano", "coffee", "Americano", "Americano", "coffee", 30000),
  menuItem("salt-cream-coffee", "coffee", "Cà Phê Kem Muối", "Iced Coffee W/Salty Milk Foam", "coffee", 35000),
  menuItem("egg-cream-coffee", "coffee", "Cà Phê Kem Trứng", "Iced Coffee W/Egg Milk Foam", "coffee", 35000),
  menuItem("bac-xiu", "coffee", "Bạc Xỉu", "Vietnamese White Coffee", "coffee", 35000),
  menuItem("almond-fresh-milk-coffee", "coffee", "Cà Phê Sữa Tươi Hạnh Nhân", "Iced Coffee W/Almond & Fresh Milk", "coffee", 39000),

  menuItem("matcha-latte", "matcha", "Matcha Latte", "Matcha Latte", "matcha", 39000),
  menuItem("matcha-oat-milk", "matcha", "Matcha Sữa Yến Mạch", "Matcha Oat Milk Latte", "matcha", 47000),
  menuItem("matcha-cold-whisk", "matcha", "Matcha Cold Whisk", "Matcha Cold Whisk", "matcha", 39000),

  menuItem("pork-pate-floss-cheese", "bread", "Pate Chà Bông Phô Mai", "Pork Pate & Pork Floss with Cheese", "bread", 17000),
  menuItem("sausage-cheese", "bread", "Xúc Xích Phô Mai", "Sausage with Cheese", "bread", 19000),
  menuItem("spicy-chicken-cheese", "bread", "Gà Cay Ngọt Phô Mai", "Spicy Chicken with Cheese", "bread", 22000),
  menuItem("beef-cheese", "bread", "Bò Phô Mai", "Beef with Cheese", "bread", 25000)
];

export const barQueue: BarTicket[] = [
  {
    id: "bar-1",
    orderNo: "T-1027",
    type: "TAKEAWAY",
    status: "PREPARING",
    age: "4 phút",
    items: [
      { name: "Cà Phê Sữa", variant: "Ly", modifiers: ["50% đường", "Thêm shot"], status: "Brewing" },
      { name: "Trà Đào Atiso", variant: "Ly", modifiers: ["Ít đá"], status: "Queued" }
    ]
  },
  {
    id: "bar-2",
    orderNo: "D-15",
    type: "DINE_IN",
    status: "READY",
    age: "7 phút",
    items: [{ name: "Matcha Sữa Yến Mạch", variant: "Ly", modifiers: ["70% đường"], status: "Ready" }]
  }
];

export const recentOrders: RecentOrder[] = [
  { id: "1", orderNo: "T-1028", customer: "Mang đi", status: "SENT", paymentStatus: "PAID", total: 78000, createdAt: "09:42" },
  { id: "2", orderNo: "D-14", customer: "Bàn 04", status: "READY", paymentStatus: "UNPAID", total: 108000, createdAt: "09:35" },
  { id: "3", orderNo: "T-1026", customer: "Mang đi", status: "CLOSED", paymentStatus: "PAID", total: 96000, createdAt: "09:18" }
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
