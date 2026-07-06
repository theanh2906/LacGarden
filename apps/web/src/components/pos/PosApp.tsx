"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  Bike,
  Check,
  ChevronDown,
  ClipboardList,
  Coffee,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Wifi
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatVnd } from "@/lib/money";
import type { BarTicket, CartItem, MenuItem, MenuVariant, OrderStatus, OrderType, PosSnapshot } from "@/types/pos";
import styles from "./PosApp.module.scss";

export type PosView = "POS" | "Orders" | "Queue" | "Reports" | "Settings";

const orderTypeLabels: Record<OrderType, string> = {
  TAKEAWAY: "Mang đi",
  DINE_IN: "Tại quán",
  DELIVERY: "Giao hàng"
};

const orderTypeIcons = {
  TAKEAWAY: ShoppingBag,
  DINE_IN: Coffee,
  DELIVERY: Bike
};

export function PosApp({ initialSnapshot, initialView = "POS" }: { initialSnapshot: PosSnapshot; initialView?: PosView }) {
  const [activeView, setActiveView] = useState<PosView>(initialView);
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [toast, setToast] = useState("Sẵn sàng nhận đơn");
  const [pendingOrderAction, setPendingOrderAction] = useState<"send" | "pay" | null>(null);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isSubmitting = pendingOrderAction !== null;

  const visibleItems = useMemo(() => {
    return snapshot.menuItems.filter((item) => {
      const categoryMatch = activeCategory === "all" || item.categoryId === activeCategory;
      const textMatch = `${item.name} ${item.description} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return categoryMatch && textMatch;
    });
  }, [activeCategory, query, snapshot.menuItems]);

  const subtotal = cartItems.reduce((sum, cartItem) => sum + cartItem.variant.price * cartItem.quantity, 0);
  const total = subtotal;

  function addToCart(item: MenuItem, variant: MenuVariant) {
    const cartId = `${item.id}-${variant.id}`;
    setCartItems((current) => {
      const found = current.find((cartItem) => cartItem.cartId === cartId);
      if (found) {
        return current.map((cartItem) =>
          cartItem.cartId === cartId ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...current, { cartId, item, variant, quantity: 1, modifiers: defaultModifiers(item) }];
    });
    setToast(`Đã thêm ${item.name} vào giỏ`);
  }

  function updateQuantity(cartId: string, quantity: number) {
    setCartItems((current) =>
      quantity <= 0
        ? current.filter((cartItem) => cartItem.cartId !== cartId)
        : current.map((cartItem) => (cartItem.cartId === cartId ? { ...cartItem, quantity } : cartItem))
    );
  }

  async function submitOrder(action: "send" | "pay") {
    if (!cartItems.length) {
      setToast("Giỏ hàng đang trống");
      return;
    }

    setPendingOrderAction(action);
    setToast(action === "send" ? "Đang gửi đơn sang quầy pha chế..." : "Đang ghi nhận thanh toán...");
    try {
      const payload = {
        orderType,
        note: orderNote || undefined,
        items: cartItems.map((cartItem) => ({
          menuItemId: cartItem.item.id,
          variantId: cartItem.variant.id,
          quantity: cartItem.quantity,
          modifiers: cartItem.modifiers
        }))
      };
      const response = await fetch(action === "send" ? "/api/orders" : "/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "send" ? payload : { ...payload, paymentMethod: "CASH", receivedAmount: total })
      });

      if (!response.ok) {
        setToast("Không thể ghi nhận đơn. Kiểm tra admin logs.");
        return;
      }

      setCartItems([]);
      setOrderNote("");
      setToast(action === "send" ? "Đã gửi đơn sang quầy pha chế" : `Đã thanh toán ${formatVnd(total)}`);
      await refreshOperationalData();
    } catch (error) {
      console.info("[pos-ui] Order submit failed", error);
      setToast("Không thể ghi nhận đơn. Kiểm tra admin logs.");
    } finally {
      setPendingOrderAction(null);
    }
  }

  async function updateTicketStatus(ticket: BarTicket, status: OrderStatus) {
    setPendingTicketId(ticket.id);
    setToast(`Đang cập nhật ${ticket.orderNo}...`);
    try {
      const response = await fetch(`/api/orders/${ticket.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        setToast("Không thể cập nhật trạng thái đơn.");
        return;
      }
      setToast(`Đã cập nhật ${ticket.orderNo}`);
      await refreshOperationalData();
    } catch (error) {
      console.info("[pos-ui] Order status update failed", error);
      setToast("Không thể cập nhật trạng thái đơn.");
    } finally {
      setPendingTicketId(null);
    }
  }

  async function refreshOperationalData() {
    setIsRefreshing(true);
    try {
      const [ordersResponse, barResponse, salesResponse] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/bar"),
        fetch("/api/reports/sales")
      ]);
      const [orders, bar, sales] = await Promise.all([ordersResponse.json(), barResponse.json(), salesResponse.json()]);
      setSnapshot((current) => ({
        ...current,
        recentOrders: Array.isArray(orders.data) ? orders.data : [],
        barQueue: Array.isArray(bar.data) ? bar.data : [],
        salesReport: sales.data ?? current.salesReport
      }));
    } catch (error) {
      console.info("[pos-ui] Refresh failed", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <main className={styles.screen}>
      <aside className={styles.sidebar} aria-label="Điều hướng chính">
        <div className={styles.brandMark}>
          <Coffee size={28} />
        </div>
        <NavItem icon={ReceiptText} label="POS" active={activeView === "POS"} onClick={() => setActiveView("POS")} />
        <NavItem icon={ClipboardList} label="Đơn hàng" active={activeView === "Orders"} onClick={() => setActiveView("Orders")} />
        <NavItem icon={Coffee} label="Pha chế" active={activeView === "Queue"} onClick={() => setActiveView("Queue")} />
        <NavItem icon={BarChart3} label="Báo cáo" active={activeView === "Reports"} onClick={() => setActiveView("Reports")} />
        <NavItem icon={Package} label="Kho" href="/inventory" />
        <NavItem icon={Settings} label="Cài đặt" active={activeView === "Settings"} onClick={() => setActiveView("Settings")} />
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.storeBlock}>
            <strong>Lac Garden Coffee</strong>
            <button className={styles.locationButton}>
              Quầy chính <ChevronDown size={16} />
            </button>
          </div>

          <div className={styles.statusRail}>
            <div className={styles.statusItem}>
              <span className={styles.liveDot} />
              <div>
                <strong>Dữ liệu thật</strong>
                <small>Cloud SQL PostgreSQL</small>
              </div>
            </div>
            <div className={styles.statusItem}>
              <Wifi size={18} />
              <div>
                <strong>{isRefreshing ? "Đang đồng bộ" : "Sẵn sàng bán hàng"}</strong>
                <small>
                  {isRefreshing ? (
                    <span className={styles.inlineLoading}>
                      <Loader2 size={12} /> Cập nhật dữ liệu
                    </span>
                  ) : (
                    `${snapshot.menuItems.length} món đang bật`
                  )}
                </small>
              </div>
            </div>
            <button className={styles.iconButton} aria-label="Thông báo">
              <Bell size={19} />
            </button>
            <div className={styles.profile}>
              <span>S</span>
              <div>
                <strong>System</strong>
                <small>Cashier</small>
              </div>
            </div>
          </div>
        </header>

        <div className={`${styles.contentGrid} ${activeView !== "POS" ? styles.singlePane : ""}`}>
          {activeView === "POS" ? (
            <>
              <section className={styles.menuPane}>
                <div className={styles.categoryTabs} aria-label="Danh mục menu">
                  {snapshot.menuCategories.map((category) => (
                    <button
                      key={category.id}
                      className={category.id === activeCategory ? styles.activeTab : undefined}
                      onClick={() => setActiveCategory(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <div className={styles.searchRow}>
                  <label className={styles.searchBox}>
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm món, đồ uống, tuỳ chọn"
                    />
                  </label>
                  <button className={styles.secondaryAction}>Quét mã</button>
                  <button className={styles.iconButton} aria-label="Lọc menu">
                    <SlidersHorizontal size={19} />
                  </button>
                </div>

                <div className={styles.menuGrid}>
                  {visibleItems.map((item) => {
                    const defaultVariant = item.variants[0];
                    return (
                      <button
                        className={styles.productCard}
                        key={item.id}
                        type="button"
                        onClick={() => defaultVariant && addToCart(item, defaultVariant)}
                        disabled={isSubmitting || !defaultVariant}
                        aria-label={`Thêm ${item.name} vào giỏ`}
                      >
                        <CoffeeVisual tone={item.image} />
                        <div className={styles.productBody}>
                          <div>
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                          </div>
                          <strong>{formatVnd(defaultVariant?.price ?? 0)}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <BaristaStrip barQueue={snapshot.barQueue} recentOrders={snapshot.recentOrders} />
              </section>

              <aside className={styles.cartPane}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Loại đơn</h2>
                    <p>{cartItems.length ? "Đơn mới" : "Chưa có món"}</p>
                  </div>
                  <span>{cartItems.length} món</span>
                </div>

                <div className={styles.segmented}>
                  {(Object.keys(orderTypeLabels) as OrderType[]).map((type) => {
                    const Icon = orderTypeIcons[type];
                    return (
                    <button key={type} className={orderType === type ? styles.selectedSegment : ""} onClick={() => setOrderType(type)} disabled={isSubmitting}>
                        <Icon size={16} />
                        {orderTypeLabels[type]}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.cartList}>
                  {cartItems.map((cartItem, index) => (
                    <div className={styles.cartLine} key={cartItem.cartId}>
                      <span className={styles.cartIndex}>{index + 1}</span>
                      <CoffeeVisual tone={cartItem.item.image} compact />
                      <div className={styles.cartLineContent}>
                        <div className={styles.cartLineTop}>
                          <strong>{cartItem.item.name}</strong>
                          <span>{formatVnd(cartItem.variant.price * cartItem.quantity)}</span>
                        </div>
                        <p>
                          {cartItem.variant.name} · {cartItem.modifiers.join(", ")}
                        </p>
                        <div className={styles.quantityControl}>
                          <button onClick={() => updateQuantity(cartItem.cartId, cartItem.quantity - 1)} aria-label="Giảm số lượng" disabled={isSubmitting}>
                            <Minus size={15} />
                          </button>
                          <span>{cartItem.quantity}</span>
                          <button onClick={() => updateQuantity(cartItem.cartId, cartItem.quantity + 1)} aria-label="Tăng số lượng" disabled={isSubmitting}>
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className={styles.addItemButton} type="button" disabled>
                  <Plus size={18} /> Thêm món tuỳ chỉnh
                </button>

                <textarea
                  className={styles.noteBox}
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value)}
                  placeholder="Ghi chú đơn hàng cho quầy pha chế/bếp"
                />

                <div className={styles.totals}>
                  <div>
                    <span>Tạm tính</span>
                    <strong>{formatVnd(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Giảm giá</span>
                    <strong>{formatVnd(0)}</strong>
                  </div>
                  <div className={styles.totalLine}>
                    <span>Tổng cộng</span>
                    <strong>{formatVnd(total)}</strong>
                  </div>
                </div>

                <div className={styles.actionStack}>
                  <button className={styles.sendButton} onClick={() => submitOrder("send")} disabled={isSubmitting}>
                    {pendingOrderAction === "send" ? <Loader2 className={styles.spinnerIcon} size={18} /> : <Send size={18} />}
                    {pendingOrderAction === "send" ? "Đang gửi..." : "Gửi pha chế"}
                  </button>
                  <button className={styles.payButton} onClick={() => submitOrder("pay")} disabled={isSubmitting}>
                    {pendingOrderAction === "pay" ? <Loader2 className={styles.spinnerIcon} size={18} /> : <CreditCard size={18} />}
                    {pendingOrderAction === "pay" ? "Đang thanh toán..." : `Thanh toán ${formatVnd(total)}`}
                  </button>
                </div>

                <p className={styles.toast}>{toast}</p>
              </aside>
            </>
          ) : (
            <Workspace view={activeView} snapshot={snapshot} pendingTicketId={pendingTicketId} updateTicketStatus={updateTicketStatus} />
          )}
        </div>
      </section>
    </main>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  href
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <Icon size={22} />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link className={styles.navItem} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={`${styles.navItem} ${active ? styles.activeNav : ""}`} onClick={onClick} type="button">
      {content}
    </button>
  );
}

function Workspace({
  view,
  snapshot,
  pendingTicketId,
  updateTicketStatus
}: {
  view: Exclude<PosView, "POS">;
  snapshot: PosSnapshot;
  pendingTicketId: string | null;
  updateTicketStatus: (ticket: BarTicket, status: OrderStatus) => Promise<void>;
}) {
  if (view === "Orders") {
    return (
      <section className={styles.pagePane}>
        <SectionHeading title="Đơn hàng" description="Lịch sử đơn hàng mới nhất từ database." />
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span>Đơn</span>
            <span>Khách/Bàn</span>
            <span>Trạng thái</span>
            <span>Thanh toán</span>
            <span>Tổng</span>
          </div>
          {snapshot.recentOrders.map((order) => (
            <div className={styles.tableRow} key={order.id}>
              <strong>{order.orderNo}</strong>
              <span>{order.customer}</span>
              <span>{orderStatusText(order.status)}</span>
              <span>{paymentStatusText(order.paymentStatus)}</span>
              <strong>{formatVnd(order.total)}</strong>
            </div>
          ))}
          {!snapshot.recentOrders.length ? <p className={styles.emptyText}>Chưa có đơn hàng.</p> : null}
        </div>
      </section>
    );
  }

  if (view === "Queue") {
    return (
      <section className={styles.pagePane}>
        <SectionHeading title="Quầy pha chế" description="Các đơn đang chờ pha chế hoặc sẵn sàng phục vụ." />
        <div className={styles.queueGrid}>
          {snapshot.barQueue.map((ticket) => (
            <article className={styles.queueCard} key={ticket.id}>
              <div className={styles.queueTop}>
                <strong>{ticket.orderNo}</strong>
                <span>{orderStatusText(ticket.status)}</span>
              </div>
              <p>
                {orderTypeLabels[ticket.type]} · {ticket.age}
              </p>
              {ticket.items.map((item, index) => (
                <div className={styles.queueLine} key={`${ticket.id}-${item.name}-${index}`}>
                  <span>{item.name}</span>
                  <small>
                    {item.variant} · {item.modifiers.join(", ") || "Mặc định"}
                  </small>
                  <strong>{barItemStatusText(item.status)}</strong>
                </div>
              ))}
              <div className={styles.queueActions}>{queueActions(ticket, pendingTicketId, updateTicketStatus)}</div>
            </article>
          ))}
          {!snapshot.barQueue.length ? <p className={styles.emptyText}>Không có đơn nào trong hàng chờ.</p> : null}
        </div>
      </section>
    );
  }

  if (view === "Reports") {
    const report = snapshot.salesReport;
    return (
      <section className={styles.pagePane}>
        <SectionHeading title="Báo cáo" description="Tổng quan doanh thu hôm nay từ đơn hàng và thanh toán thật." />
        <div className={styles.metricGrid}>
          <Metric label="Doanh thu hôm nay" value={formatVnd(report.revenueToday)} />
          <Metric label="Số đơn" value={String(report.orderCount)} />
          <Metric label="Trung bình/đơn" value={formatVnd(report.averageOrderValue)} />
          <Metric label="Tiền mặt / chuyển khoản" value={`${report.cashPercent}% / ${report.transferPercent}%`} />
        </div>
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span>Sản phẩm</span>
            <span>SL</span>
            <span>Doanh thu</span>
            <span>Xu hướng</span>
            <span>Trạng thái</span>
          </div>
          {report.topProducts.map((item) => (
            <div className={styles.tableRow} key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.quantity}</span>
              <span>{formatVnd(item.revenue)}</span>
              <span>Hôm nay</span>
              <span>{item.status}</span>
            </div>
          ))}
          {!report.topProducts.length ? <p className={styles.emptyText}>Chưa có dữ liệu bán hàng hôm nay.</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.pagePane}>
      <SectionHeading title="Cài đặt" description="Các cấu hình vận hành sẽ được bổ sung sau khi có auth và phân quyền." />
      <div className={styles.tableCard}>
        <p className={styles.emptyText}>Chưa có cấu hình khả dụng trong phiên bản này.</p>
      </div>
    </section>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.sectionHeading}>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CoffeeVisual({ tone, compact = false }: { tone: string; compact?: boolean }) {
  return (
    <div className={`${styles.coffeeVisual} ${styles[`tone_${tone}`]} ${compact ? styles.compactVisual : ""}`} aria-hidden="true">
      <div className={styles.cup}>
        <span />
      </div>
    </div>
  );
}

function BaristaStrip({ barQueue, recentOrders }: Pick<PosSnapshot, "barQueue" | "recentOrders">) {
  return (
    <section className={styles.baristaStrip}>
      <div className={styles.stripTitle}>
        <Coffee size={18} />
        <strong>Quầy pha chế</strong>
        <span>{barQueue.length} đơn</span>
      </div>
      {barQueue.slice(0, 2).map((ticket) => (
        <article key={ticket.id} className={styles.ticketCard}>
          <span className={ticket.status === "READY" ? styles.readyRail : styles.progressRail} />
          <div>
            <strong>{ticket.orderNo}</strong>
            <small>
              {orderTypeLabels[ticket.type]} · {ticket.items.length} món
            </small>
          </div>
          <span>{ticket.age}</span>
          {ticket.status === "READY" ? <Check size={18} /> : null}
        </article>
      ))}
      <div className={styles.recentOrders}>
        {recentOrders.slice(0, 2).map((order) => (
          <div key={order.id}>
            <strong>{order.orderNo}</strong>
            <small>
              {orderStatusText(order.status)} · {formatVnd(order.total)}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

function queueActions(ticket: BarTicket, pendingTicketId: string | null, updateTicketStatus: (ticket: BarTicket, status: OrderStatus) => Promise<void>) {
  const isLoading = pendingTicketId === ticket.id;
  const icon = isLoading ? <Loader2 className={styles.spinnerIcon} size={16} /> : null;
  if (ticket.status === "SENT") {
    return (
      <button onClick={() => updateTicketStatus(ticket, "PREPARING")} disabled={pendingTicketId !== null}>
        {icon}
        {isLoading ? "Đang cập nhật..." : "Bắt đầu pha"}
      </button>
    );
  }
  if (ticket.status === "PREPARING") {
    return (
      <button onClick={() => updateTicketStatus(ticket, "READY")} disabled={pendingTicketId !== null}>
        {icon}
        {isLoading ? "Đang cập nhật..." : "Hoàn tất"}
      </button>
    );
  }
  if (ticket.status === "READY") {
    return (
      <button onClick={() => updateTicketStatus(ticket, "SERVED")} disabled={pendingTicketId !== null}>
        {icon}
        {isLoading ? "Đang cập nhật..." : "Đã phục vụ"}
      </button>
    );
  }
  return null;
}

function defaultModifiers(item: MenuItem) {
  if (item.image === "coffee") return ["50% đường"];
  if (item.image === "soda" || item.image === "fruittea") return ["Ít đá"];
  if (item.image === "matcha" || item.image === "yogurt" || item.image === "milktea") return ["70% đường"];
  if (item.image === "bread") return ["Làm nóng"];
  return ["Mặc định"];
}

function orderStatusText(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Nháp",
    SENT: "Đã gửi",
    PREPARING: "Đang pha",
    READY: "Sẵn sàng",
    SERVED: "Đã phục vụ",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã huỷ"
  };
  return map[status] ?? status;
}

function paymentStatusText(status: string) {
  const map: Record<string, string> = {
    UNPAID: "Chưa trả",
    PARTIAL: "Trả một phần",
    PAID: "Đã trả",
    REFUNDED: "Đã hoàn"
  };
  return map[status] ?? status;
}

function barItemStatusText(status: string) {
  const map: Record<string, string> = {
    Queued: "Đang chờ",
    Brewing: "Đang pha",
    Ready: "Xong",
    Served: "Đã phục vụ",
    Cancelled: "Đã huỷ"
  };
  return map[status] ?? status;
}
