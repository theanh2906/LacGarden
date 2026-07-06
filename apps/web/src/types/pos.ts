export type OrderType = "TAKEAWAY" | "DINE_IN" | "DELIVERY";
export type OrderStatus = "DRAFT" | "SENT" | "PREPARING" | "READY" | "SERVED" | "CLOSED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "QR" | "CARD" | "OTHER";
export type BarItemStatus = "Queued" | "Brewing" | "Ready" | "Served" | "Cancelled";

export type MenuVariant = {
  id: string;
  name: string;
  price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  tags: string[];
  variants: MenuVariant[];
};

export type MenuCategory = {
  id: string;
  name: string;
};

export type CartItem = {
  cartId: string;
  item: MenuItem;
  variant: MenuVariant;
  quantity: number;
  modifiers: string[];
};

export type RecentOrder = {
  id: string;
  orderNo: string;
  customer: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string;
  itemCount: number;
};

export type BarTicket = {
  id: string;
  orderNo: string;
  type: OrderType;
  status: OrderStatus;
  age: string;
  items: Array<{
    name: string;
    variant: string;
    modifiers: string[];
    status: BarItemStatus;
  }>;
};

export type SalesReportDto = {
  revenueToday: number;
  orderCount: number;
  averageOrderValue: number;
  cashPercent: number;
  transferPercent: number;
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    status: string;
  }>;
};

export type PosSnapshot = {
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  recentOrders: RecentOrder[];
  barQueue: BarTicket[];
  salesReport: SalesReportDto;
};
