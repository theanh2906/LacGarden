export type OrderType = "TAKEAWAY" | "DINE_IN" | "DELIVERY";
export type OrderStatus = "SENT" | "PREPARING" | "READY" | "SERVED" | "CLOSED";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

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
    status: "Queued" | "Brewing" | "Ready";
  }>;
};

export type RecentOrder = {
  id: string;
  orderNo: string;
  customer: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string;
};
