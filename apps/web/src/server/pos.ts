import { Prisma } from "@prisma/client";
import { createOrderItemCostSnapshotsInTransaction, getMenuVariantCostSummaries, type MenuVariantCostSummary } from "@/server/costing";
import { getDb } from "@/server/db";
import { buildProviderReference, createBankTransferQrRequest, getBankTransferExpiryDate } from "@/server/payment-qr";
import type { AddPaymentInput, CheckoutOrderInput, CreateOrderInput, UpdateOrderStatusInput } from "@/server/pos-validation";
import type { QrPaymentRequest } from "@/types/payment";
import type {
  BarItemStatus,
  BarTicket,
  MenuCategory,
  MenuItem,
  PaymentMethod,
  PosSnapshot,
  RecentOrder,
  SalesReportDto
} from "@/types/pos";

const SYSTEM_CASHIER_USERNAME = "system-cashier";
const RECENT_ORDER_LIMIT = 20;
const ADVISORY_ORDER_SEQUENCE_LOCK = 731_202_607;
const TIME_ZONE = "Asia/Bangkok";
const POS_TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

type PosMenuItem = Prisma.MenuItemGetPayload<{
  include: {
    category: true;
    variants: true;
  };
}>;

type PosOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payments: true;
  };
}>;

type PosPayment = Prisma.PaymentGetPayload<Record<string, never>>;

type StaffContext = {
  staffId?: string;
};

export function getEmptySalesReport(): SalesReportDto {
  return {
    revenueToday: 0,
    orderCount: 0,
    averageOrderValue: 0,
    cashPercent: 0,
    transferPercent: 0,
    topProducts: []
  };
}

export async function getPosSnapshot({ includeSalesReport = true }: { includeSalesReport?: boolean } = {}): Promise<PosSnapshot> {
  const [menu, recentOrders, barQueue, salesReport] = await Promise.all([
    listMenu(),
    listRecentOrders(),
    listBarQueue(),
    includeSalesReport ? getSalesReport() : getEmptySalesReport()
  ]);

  return {
    ...menu,
    recentOrders,
    barQueue,
    salesReport
  };
}

export async function listMenu(): Promise<{ menuCategories: MenuCategory[]; menuItems: MenuItem[] }> {
  const db = getDb();
  const [categories, items] = await Promise.all([
    db.menuCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    db.menuItem.findMany({
      where: {
        isActive: true,
        category: { isActive: true }
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    })
  ]);

  const variantCostById = await getMenuVariantCostSummaries(
    items.flatMap((item) => item.variants.map((variant) => ({ id: variant.id, itemId: variant.itemId, price: variant.price })))
  ).catch((error) => {
    console.info("[pos] Failed to load product costing summaries", error);
    return new Map<string, MenuVariantCostSummary>();
  });

  return {
    menuCategories: [{ id: "all", name: "Tất cả" }, ...categories.map((category) => ({ id: category.id, name: category.name }))],
    menuItems: items.map((item) => mapMenuItem(item, variantCostById)).filter((item) => item.variants.length > 0)
  };
}

export async function listRecentOrders(limit = RECENT_ORDER_LIMIT): Promise<RecentOrder[]> {
  const db = getDb();
  const orders = await db.order.findMany({
    include: {
      items: true,
      payments: true
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return orders.map(mapRecentOrder);
}

export async function listBarQueue(): Promise<BarTicket[]> {
  const db = getDb();
  const orders = await db.order.findMany({
    where: {
      status: { in: ["SENT", "PREPARING", "READY"] }
    },
    include: {
      items: {
        orderBy: { createdAt: "asc" }
      },
      payments: true
    },
    orderBy: { createdAt: "asc" },
    take: 24
  });

  return orders.map(mapBarTicket);
}

export async function getSalesReport(): Promise<SalesReportDto> {
  const db = getDb();
  const { start, end } = getBangkokDayRange();

  const [orders, payments] = await Promise.all([
    db.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "CANCELLED" }
      },
      include: {
        items: true
      }
    }),
    db.payment.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: "CONFIRMED"
      }
    })
  ]);

  const revenueToday = payments.reduce((total, payment) => total + toNumber(payment.amount), 0);
  const orderCount = orders.length;
  const cashAmount = payments.filter((payment) => payment.method === "CASH").reduce((total, payment) => total + toNumber(payment.amount), 0);
  const transferAmount = Math.max(0, revenueToday - cashAmount);
  const productTotals = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const id = item.menuItemId ?? item.id;
      const current = productTotals.get(id) ?? {
        id,
        name: item.itemNameSnapshot,
        quantity: 0,
        revenue: 0
      };
      current.quantity += item.quantity;
      current.revenue += toNumber(item.lineTotal);
      productTotals.set(id, current);
    }
  }

  return {
    revenueToday,
    orderCount,
    averageOrderValue: orderCount ? Math.round(revenueToday / orderCount) : 0,
    cashPercent: revenueToday ? Math.round((cashAmount / revenueToday) * 100) : 0,
    transferPercent: revenueToday ? Math.round((transferAmount / revenueToday) * 100) : 0,
    topProducts: [...productTotals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((product) => ({ ...product, status: "Đang bán" }))
  };
}

export async function getPrintableReceipt(orderId: string) {
  const db = getDb();
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      createdBy: {
        select: {
          displayName: true
        }
      },
      items: {
        orderBy: { createdAt: "asc" }
      },
      payments: {
        where: {
          status: "CONFIRMED"
        },
        include: {
          confirmedBy: {
            select: {
              displayName: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (order.paymentStatus !== "PAID") {
    throw new PosServiceError("Receipt is only available for paid orders.");
  }

  return {
    id: order.id,
    orderNo: order.orderNo,
    orderType: order.orderType,
    orderTypeLabel: orderTypeLabel(order.orderType),
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: toNumber(order.subtotal),
    discountTotal: toNumber(order.discountTotal),
    total: toNumber(order.total),
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    cashierName: order.createdBy.displayName,
    items: order.items.map((item) => {
      const lineNote = parseLineNote(item.note);
      return {
        id: item.id,
        name: item.itemNameSnapshot,
        variant: item.variantNameSnapshot ?? "Ly",
        quantity: item.quantity,
        unitPrice: toNumber(item.unitPriceSnapshot),
        lineTotal: toNumber(item.lineTotal),
        modifiers: lineNote.modifiers,
        note: lineNote.note
      };
    }),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: toNumber(payment.amount),
      receivedAmount: toNumber(payment.receivedAmount),
      changeAmount: toNumber(payment.changeAmount),
      confirmedByName: payment.confirmedBy.displayName,
      createdAt: payment.createdAt.toISOString()
    }))
  };
}

export async function getPrintableBarTicket(orderId: string) {
  const db = getDb();
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!["SENT", "PREPARING", "READY"].includes(order.status)) {
    throw new PosServiceError("Bar ticket is only available for active queue orders.");
  }

  return {
    id: order.id,
    orderNo: order.orderNo,
    orderType: order.orderType,
    orderTypeLabel: orderTypeLabel(order.orderType),
    status: order.status,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    age: formatAge(order.createdAt),
    items: order.items
      .filter((item) => item.status !== "CANCELLED")
      .map((item) => {
        const lineNote = parseLineNote(item.note);
        return {
          id: item.id,
          name: item.itemNameSnapshot,
          variant: item.variantNameSnapshot ?? "Ly",
          quantity: item.quantity,
          modifiers: lineNote.modifiers,
          note: lineNote.note,
          status: itemStatusLabel(item.status)
        };
      })
  };
}

export async function createOrder(input: CreateOrderInput, context: StaffContext = {}): Promise<RecentOrder> {
  const db = getDb();
  const order = await db.$transaction(async (tx) => createOrderInTransaction(tx, input, context), POS_TRANSACTION_OPTIONS);
  await recordOrderItemCostSnapshots(order);
  return mapRecentOrder(order);
}

export async function checkoutOrder(input: CheckoutOrderInput, context: StaffContext = {}): Promise<RecentOrder> {
  const db = getDb();
  const order = await db.$transaction(
    async (tx) => {
      const createdOrder = await createOrderInTransaction(tx, input, context);
      await createPaymentInTransaction(tx, {
        orderId: createdOrder.id,
        method: input.paymentMethod,
        amount: toNumber(createdOrder.total),
        receivedAmount: input.receivedAmount,
        note: input.note,
        staffId: context.staffId
      });
      return getOrderByIdInTransaction(tx, createdOrder.id);
    },
    POS_TRANSACTION_OPTIONS
  );

  await recordOrderItemCostSnapshots(order);
  return mapRecentOrder(order);
}

export async function checkoutOrderWithBankTransferQr(
  input: CreateOrderInput,
  context: StaffContext = {}
): Promise<{ order: RecentOrder; payment: QrPaymentRequest }> {
  const db = getDb();
  const result = await db.$transaction(
    async (tx) => {
      const createdOrder = await createOrderInTransaction(tx, input, context);
      const payment = await createPendingBankTransferPaymentInTransaction(tx, createdOrder, context);
      return {
        order: await getOrderByIdInTransaction(tx, createdOrder.id),
        payment
      };
    },
    POS_TRANSACTION_OPTIONS
  );

  await recordOrderItemCostSnapshots(result.order);
  return {
    order: mapRecentOrder(result.order),
    payment: result.payment
  };
}

export async function addOrderPayment(orderId: string, input: AddPaymentInput, context: StaffContext = {}): Promise<RecentOrder> {
  const db = getDb();
  const order = await db.$transaction(
    async (tx) => {
      await createPaymentInTransaction(tx, {
        orderId,
        method: input.method,
        amount: input.amount,
        receivedAmount: input.receivedAmount,
        note: input.note,
        staffId: context.staffId
      });
      return getOrderByIdInTransaction(tx, orderId);
    },
    POS_TRANSACTION_OPTIONS
  );

  return mapRecentOrder(order);
}

export async function confirmPaymentManually(paymentId: string, context: StaffContext = {}): Promise<{ order: RecentOrder; payment: ManualPaymentConfirmation }> {
  const db = getDb();
  const result = await db.$transaction(
    async (tx) => {
      const cashier = await getStaffOrSystemCashier(tx, context.staffId);
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          order: {
            include: {
              items: true,
              payments: true
            }
          }
        }
      });

      if (payment.status === "CONFIRMED") {
        throw new PosServiceError("Payment has already been confirmed.");
      }
      if (payment.status !== "PENDING") {
        throw new PosServiceError("Only pending payments can be manually confirmed.");
      }
      if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { reconciliationStatus: "EXPIRED" }
        });
        throw new PosServiceError("Payment QR has expired. Create a new checkout request.");
      }
      if (payment.order.status === "CANCELLED") {
        throw new PosServiceError("Cannot confirm payment for a cancelled order.");
      }

      const paidAmount = toNumber(payment.amount);
      const paidAt = new Date();
      const updatedCount = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING"
        },
        data: {
          status: "CONFIRMED",
          receivedAmount: BigInt(paidAmount),
          changeAmount: BigInt(0),
          paidAmount: BigInt(paidAmount),
          paidAt,
          reconciliationStatus: "MANUAL_CONFIRMED",
          confirmedById: cashier.id
        }
      });

      if (updatedCount.count !== 1) {
        throw new PosServiceError("Payment has already been handled.");
      }

      const confirmedPaid =
        payment.order.payments
          .filter((orderPayment) => orderPayment.status === "CONFIRMED")
          .reduce((total, orderPayment) => total + toNumber(orderPayment.amount), 0) + paidAmount;
      const orderTotal = toNumber(payment.order.total);
      const paymentStatus = confirmedPaid >= orderTotal ? "PAID" : confirmedPaid > 0 ? "PARTIAL" : "UNPAID";

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus,
          ...(paymentStatus === "PAID" ? { paidAt } : {})
        }
      });

      const order = await getOrderByIdInTransaction(tx, payment.orderId);
      return {
        order,
        payment: {
          id: payment.id,
          status: "CONFIRMED" as const,
          paidAmount,
          paidAt: paidAt.toISOString(),
          reconciliationStatus: "MANUAL_CONFIRMED" as const
        }
      };
    },
    POS_TRANSACTION_OPTIONS
  );

  return {
    order: mapRecentOrder(result.order),
    payment: result.payment
  };
}

export async function updateOrderStatus(orderId: string, input: UpdateOrderStatusInput): Promise<RecentOrder> {
  const db = getDb();
  const order = await db.$transaction(
    async (tx) => {
      const existing = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, payments: true }
      });
      assertAllowedTransition(existing.status, input.status);

      const now = new Date();
      await tx.orderItem.updateMany({
        where: { orderId },
        data: { status: statusToItemStatus(input.status) }
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: input.status,
          ...(input.status === "SENT" ? { sentAt: existing.sentAt ?? now } : {}),
          ...(input.status === "CLOSED" || input.status === "CANCELLED" ? { closedAt: now } : {})
        }
      });

      return getOrderByIdInTransaction(tx, orderId);
    },
    POS_TRANSACTION_OPTIONS
  );

  return mapRecentOrder(order);
}

export class PosServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PosServiceError";
  }
}

export function getPosErrorMessage(error: unknown) {
  if (error instanceof PosServiceError) return error.message;
  return "POS operation failed. Check admin logs for details.";
}

type ManualPaymentConfirmation = {
  id: string;
  status: "CONFIRMED";
  paidAmount: number;
  paidAt: string;
  reconciliationStatus: "MANUAL_CONFIRMED";
};

async function createOrderInTransaction(tx: Prisma.TransactionClient, input: CreateOrderInput, context: StaffContext): Promise<PosOrder> {
  if (input.items.length === 0) {
    throw new PosServiceError("Cart is empty.");
  }

  const cashier = await getStaffOrSystemCashier(tx, context.staffId);
  const variantIds = [...new Set(input.items.map((line) => line.variantId))];
  const variants = await tx.menuItemVariant.findMany({
    where: {
      id: { in: variantIds },
      isActive: true,
      item: {
        isActive: true,
        category: { isActive: true }
      }
    },
    include: {
      item: true
    }
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  const lines = input.items.map((line) => {
    const variant = variantById.get(line.variantId);
    if (!variant || variant.itemId !== line.menuItemId) {
      throw new PosServiceError("A cart item is no longer available.");
    }

    const unitPrice = toNumber(variant.price);
    const lineTotal = unitPrice * line.quantity;
    return {
      line,
      variant,
      unitPrice,
      lineTotal
    };
  });

  const subtotal = lines.reduce((total, line) => total + line.lineTotal, 0);
  const orderNo = await generateOrderNo(tx, input.orderType);
  const now = new Date();

  const order = await tx.order.create({
    data: {
      orderNo,
      orderType: input.orderType,
      status: "SENT",
      paymentStatus: "UNPAID",
      subtotal: BigInt(subtotal),
      discountTotal: BigInt(0),
      total: BigInt(subtotal),
      note: input.note,
      createdById: cashier.id,
      sentAt: now,
      items: {
        create: lines.map(({ line, variant, unitPrice, lineTotal }) => ({
          menuItemId: variant.itemId,
          variantId: variant.id,
          itemNameSnapshot: variant.item.name,
          variantNameSnapshot: variant.name,
          unitPriceSnapshot: BigInt(unitPrice),
          quantity: line.quantity,
          lineTotal: BigInt(lineTotal),
          status: "SENT",
          note: serializeLineNote(line.modifiers, line.note)
        }))
      }
    },
    include: {
      items: true,
      payments: true
    }
  });

  return order;
}

async function recordOrderItemCostSnapshots(order: PosOrder) {
  const db = getDb();
  await db
    .$transaction(async (tx) => createOrderItemCostSnapshotsInTransaction(tx, order.items), POS_TRANSACTION_OPTIONS)
    .catch((error) => console.info("[pos] Failed to record product cost snapshots", error));
}

async function createPaymentInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    method: PaymentMethod;
    amount: number;
    receivedAmount?: number;
    note?: string;
    staffId?: string;
  }
) {
  if (input.amount <= 0) {
    throw new PosServiceError("Payment amount must be greater than zero.");
  }

  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { payments: true }
  });
  if (order.status === "CANCELLED") {
    throw new PosServiceError("Cannot pay a cancelled order.");
  }

  const cashier = await getStaffOrSystemCashier(tx, input.staffId);
  const receivedAmount = input.receivedAmount ?? input.amount;
  const changeAmount = Math.max(0, receivedAmount - input.amount);
  const paidAt = new Date();

  await tx.payment.create({
    data: {
      orderId: input.orderId,
      method: input.method,
      status: "CONFIRMED",
      amount: BigInt(input.amount),
      receivedAmount: BigInt(receivedAmount),
      changeAmount: BigInt(changeAmount),
      paidAmount: BigInt(input.amount),
      paidAt,
      reconciliationStatus: "NOT_REQUIRED",
      note: input.note,
      confirmedById: cashier.id
    }
  });

  const confirmedPaid = order.payments
    .filter((payment) => payment.status === "CONFIRMED")
    .reduce((total, payment) => total + toNumber(payment.amount), input.amount);
  const total = toNumber(order.total);
  const paymentStatus = confirmedPaid >= total ? "PAID" : confirmedPaid > 0 ? "PARTIAL" : "UNPAID";

  await tx.order.update({
    where: { id: input.orderId },
    data: {
      paymentStatus,
      ...(paymentStatus === "PAID" ? { paidAt } : {})
    }
  });
}

async function createPendingBankTransferPaymentInTransaction(
  tx: Prisma.TransactionClient,
  order: PosOrder,
  context: StaffContext
): Promise<QrPaymentRequest> {
  const amount = toNumber(order.total);
  if (amount <= 0) {
    throw new PosServiceError("Payment amount must be greater than zero.");
  }

  const cashier = await getStaffOrSystemCashier(tx, context.staffId);
  const providerReference = buildProviderReference(order.orderNo);
  const expiresAt = getBankTransferExpiryDate();
  const duplicatePending = await tx.payment.findFirst({
    where: {
      orderId: order.id,
      method: "BANK_TRANSFER",
      status: "PENDING"
    }
  });

  if (duplicatePending) {
    throw new PosServiceError("A pending bank transfer payment already exists for this order.");
  }

  const payment = await tx.payment.create({
    data: {
      orderId: order.id,
      method: "BANK_TRANSFER",
      status: "PENDING",
      amount: BigInt(amount),
      receivedAmount: null,
      changeAmount: BigInt(0),
      paidAmount: null,
      paidAt: null,
      provider: "vietqr",
      providerReference,
      reconciliationStatus: "PENDING",
      expiresAt,
      note: "Awaiting manual bank transfer confirmation",
      confirmedById: cashier.id
    }
  });

  return createBankTransferQrRequest({
    paymentId: payment.id,
    orderId: order.id,
    orderNo: order.orderNo,
    amount,
    expiresAt
  });
}

async function getOrderByIdInTransaction(tx: Prisma.TransactionClient, orderId: string): Promise<PosOrder> {
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: true,
      payments: true
    }
  });
}

async function getStaffOrSystemCashier(tx: Prisma.TransactionClient, staffId: string | undefined) {
  if (staffId) {
    const staff = await tx.user.findFirst({
      where: {
        id: staffId,
        isActive: true
      }
    });
    if (!staff) {
      throw new PosServiceError("Staff session is no longer active.");
    }
    return staff;
  }

  return getSystemCashier(tx);
}

async function getSystemCashier(tx: Prisma.TransactionClient) {
  return tx.user.upsert({
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
}

async function generateOrderNo(tx: Prisma.TransactionClient, orderType: CreateOrderInput["orderType"]) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_ORDER_SEQUENCE_LOCK})`;
  const prefix = orderTypePrefix(orderType);
  const dayKey = getBangkokDayKey();
  const sequence = await tx.order.count({
    where: {
      orderNo: {
        startsWith: `${prefix}-${dayKey}-`
      }
    }
  });

  return `${prefix}-${dayKey}-${String(sequence + 1).padStart(3, "0")}`;
}

function mapMenuItem(item: PosMenuItem, variantCostById: Map<string, MenuVariantCostSummary>): MenuItem {
  const tone = categoryTone(item.category.name);
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    categoryId: item.categoryId,
    image: tone,
    tags: [tone, item.category.name],
    variants: item.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: toNumber(variant.price),
      cost: variantCostById.get(variant.id)
    }))
  };
}

function mapRecentOrder(order: PosOrder): RecentOrder {
  return {
    id: order.id,
    orderNo: order.orderNo,
    customer: orderTypeLabel(order.orderType),
    orderType: order.orderType,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: toNumber(order.total),
    createdAt: order.createdAt.toISOString(),
    itemCount: order.items.reduce((count, item) => count + item.quantity, 0)
  };
}

function mapBarTicket(order: PosOrder): BarTicket {
  return {
    id: order.id,
    orderNo: order.orderNo,
    type: order.orderType,
    status: order.status,
    age: formatAge(order.createdAt),
    items: order.items.map((item) => {
      const note = parseLineNote(item.note);
      return {
        name: item.itemNameSnapshot,
        variant: item.variantNameSnapshot ?? "Ly",
        modifiers: note.modifiers,
        status: itemStatusLabel(item.status)
      };
    })
  };
}

function assertAllowedTransition(current: PosOrder["status"], next: UpdateOrderStatusInput["status"]) {
  if (current === next) return;
  const allowed: Record<PosOrder["status"], Array<UpdateOrderStatusInput["status"]>> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PREPARING", "READY", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["SERVED", "CLOSED", "CANCELLED"],
    SERVED: ["CLOSED"],
    CLOSED: [],
    CANCELLED: []
  };

  if (!allowed[current].includes(next)) {
    throw new PosServiceError(`Cannot move order from ${current} to ${next}.`);
  }
}

function statusToItemStatus(status: UpdateOrderStatusInput["status"]) {
  if (status === "PREPARING") return "PREPARING";
  if (status === "READY") return "READY";
  if (status === "SERVED" || status === "CLOSED") return "SERVED";
  if (status === "CANCELLED") return "CANCELLED";
  return "SENT";
}

function itemStatusLabel(status: PosOrder["items"][number]["status"]): BarItemStatus {
  if (status === "PREPARING") return "Brewing";
  if (status === "READY") return "Ready";
  if (status === "SERVED") return "Served";
  if (status === "CANCELLED") return "Cancelled";
  return "Queued";
}

function serializeLineNote(modifiers: string[], note: string | undefined) {
  return JSON.stringify({
    modifiers,
    note: note ?? null
  });
}

function parseLineNote(value: string | null) {
  if (!value) return { modifiers: [] as string[], note: null as string | null };
  try {
    const parsed = JSON.parse(value) as { modifiers?: unknown; note?: unknown };
    return {
      modifiers: Array.isArray(parsed.modifiers) ? parsed.modifiers.filter((item): item is string => typeof item === "string") : [],
      note: typeof parsed.note === "string" ? parsed.note : null
    };
  } catch {
    return {
      modifiers: value ? [value] : [],
      note: null
    };
  }
}

function categoryTone(categoryName: string) {
  const lower = categoryName.toLowerCase();
  if (lower.includes("sữa chua")) return "yogurt";
  if (lower.includes("trà trái")) return "fruittea";
  if (lower.includes("soda")) return "soda";
  if (lower.includes("trà sữa")) return "milktea";
  if (lower.includes("cacao")) return "cacao";
  if (lower.includes("matcha")) return "matcha";
  if (lower.includes("bánh")) return "bread";
  return "coffee";
}

function orderTypePrefix(orderType: CreateOrderInput["orderType"]) {
  if (orderType === "DINE_IN") return "D";
  if (orderType === "DELIVERY") return "G";
  return "T";
}

function orderTypeLabel(orderType: CreateOrderInput["orderType"]) {
  if (orderType === "DINE_IN") return "Tại quán";
  if (orderType === "DELIVERY") return "Giao hàng";
  return "Mang đi";
}

function getBangkokDayRange(date = new Date()) {
  const { year, month, day } = getBangkokParts(date);
  const start = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function getBangkokDayKey(date = new Date()) {
  const { year, month, day } = getBangkokParts(date);
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function getBangkokParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function formatAge(value: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  return `${hours} giờ`;
}

function toNumber(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}
