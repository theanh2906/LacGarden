"use client";

import {
  BarChart3,
  Bell,
  Bike,
  Check,
  ChevronDown,
  ClipboardList,
  Coffee,
  CreditCard,
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
import { barQueue, menuCategories, menuItems, recentOrders } from "@/data/mock-pos";
import { formatVnd } from "@/lib/money";
import type { CartItem, MenuItem, MenuVariant, OrderType } from "@/types/pos";
import styles from "./PosDemo.module.scss";

export type DemoView = "POS" | "Orders" | "Queue" | "Reports" | "Inventory" | "Settings";

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

export function PosDemo({ initialView = "POS" }: { initialView?: DemoView }) {
  const [activeView, setActiveView] = useState<DemoView>(initialView);
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const defaultCoffee = menuItems.find((item) => item.id === "ca-phe-sua") ?? menuItems[0];
  const defaultTea = menuItems.find((item) => item.id === "peach-artichoke-tea") ?? menuItems[1];
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      cartId: "demo-coffee",
      item: defaultCoffee,
      variant: defaultCoffee.variants[0],
      quantity: 1,
      modifiers: ["50% đường", "Thêm shot"]
    },
    {
      cartId: "demo-tea",
      item: defaultTea,
      variant: defaultTea.variants[0],
      quantity: 1,
      modifiers: ["Ít đá"]
    }
  ]);
  const [toast, setToast] = useState("Chế độ demo: giao diện đang dùng dữ liệu mô phỏng");

  const visibleItems = useMemo(() => {
    return menuItems.filter((item) => {
      const categoryMatch = activeCategory === "all" || item.categoryId === activeCategory;
      const textMatch = `${item.name} ${item.description} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return categoryMatch && textMatch;
    });
  }, [activeCategory, query]);

  const subtotal = cartItems.reduce((sum, cartItem) => sum + cartItem.variant.price * cartItem.quantity, 0);
  const service = Math.round(subtotal * 0.03);
  const total = subtotal + service;

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

  function simulateAction(action: "send" | "pay") {
    if (!cartItems.length) {
      setToast("Giỏ hàng đang trống");
      return;
    }
    setToast(action === "send" ? "Đã gửi đơn mock sang quầy pha chế" : `Đã ghi nhận thanh toán mock: ${formatVnd(total)}`);
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
        <NavItem icon={Package} label="Kho" active={activeView === "Inventory"} onClick={() => setActiveView("Inventory")} />
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
                <strong>Ca đang mở</strong>
                <small>08:00 AM - 04:00 PM</small>
              </div>
            </div>
            <div className={styles.statusItem}>
              <Wifi size={18} />
              <div>
                <strong>LAN sẵn sàng</strong>
                <small>Hoạt động offline</small>
              </div>
            </div>
            <button className={styles.iconButton} aria-label="Thông báo">
              <Bell size={19} />
            </button>
            <div className={styles.profile}>
              <span>A</span>
              <div>
                <strong>Anh</strong>
                <small>Chủ quán</small>
              </div>
            </div>
          </div>
        </header>

        <div className={`${styles.contentGrid} ${activeView !== "POS" ? styles.singlePane : ""}`}>
          {activeView === "POS" ? (
          <>
            <section className={styles.menuPane}>
            <div className={styles.categoryTabs} aria-label="Danh mục menu">
              {menuCategories.map((category) => (
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
              {visibleItems.map((item) => (
                <article className={styles.productCard} key={item.id}>
                  <CoffeeVisual tone={item.image} />
                  <div className={styles.productBody}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>
                    <strong>{formatVnd(item.variants[0].price)}</strong>
                  </div>
                  <div className={styles.variantRow}>
                    {item.variants.map((variant) => (
                      <button key={variant.id} onClick={() => addToCart(item, variant)}>
                        {variant.name}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <BaristaStrip />
          </section>

          <aside className={styles.cartPane}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Loại đơn</h2>
                <p>Đơn mẫu #T-1030</p>
              </div>
              <span>{cartItems.length} món</span>
            </div>

            <div className={styles.segmented}>
              {(Object.keys(orderTypeLabels) as OrderType[]).map((type) => {
                const Icon = orderTypeIcons[type];
                return (
                  <button key={type} className={orderType === type ? styles.selectedSegment : ""} onClick={() => setOrderType(type)}>
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
                      <button onClick={() => updateQuantity(cartItem.cartId, cartItem.quantity - 1)} aria-label="Giảm số lượng">
                        <Minus size={15} />
                      </button>
                      <span>{cartItem.quantity}</span>
                      <button onClick={() => updateQuantity(cartItem.cartId, cartItem.quantity + 1)} aria-label="Tăng số lượng">
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className={styles.addItemButton}>
              <Plus size={18} /> Thêm món tuỳ chỉnh
            </button>

            <textarea className={styles.noteBox} placeholder="Ghi chú đơn hàng cho quầy pha chế/bếp" />

            <div className={styles.totals}>
              <div>
                <span>Tạm tính</span>
                <strong>{formatVnd(subtotal)}</strong>
              </div>
              <div>
                <span>Phí phục vụ</span>
                <strong>{formatVnd(service)}</strong>
              </div>
              <div className={styles.totalLine}>
                <span>Tổng cộng</span>
                <strong>{formatVnd(total)}</strong>
              </div>
            </div>

            <div className={styles.actionStack}>
              <button className={styles.sendButton} onClick={() => simulateAction("send")}>
                <Send size={18} /> Gửi pha chế
              </button>
              <button className={styles.payButton} onClick={() => simulateAction("pay")}>
                <CreditCard size={18} /> Thanh toán {formatVnd(total)}
              </button>
            </div>

            <p className={styles.toast}>{toast}</p>
          </aside>
          </>
          ) : (
            <MockWorkspace view={activeView} />
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
  onClick
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`${styles.navItem} ${active ? styles.activeNav : ""}`} onClick={onClick} type="button">
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}

function MockWorkspace({ view }: { view: Exclude<DemoView, "POS"> }) {
  if (view === "Orders") {
    return (
      <section className={styles.mockPage}>
        <SectionHeading title="Đơn hàng" description="Lịch sử đơn hàng mô phỏng. Bộ lọc và chi tiết đơn sẽ nối backend ở bước sau." />
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span>Đơn</span>
            <span>Khách/Bàn</span>
            <span>Trạng thái</span>
            <span>Thanh toán</span>
            <span>Tổng</span>
          </div>
          {recentOrders.map((order) => (
            <button className={styles.tableRow} key={order.id} type="button">
              <strong>{order.orderNo}</strong>
              <span>{order.customer}</span>
              <span>{orderStatusText(order.status)}</span>
              <span>{paymentStatusText(order.paymentStatus)}</span>
              <strong>{formatVnd(order.total)}</strong>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (view === "Queue") {
    return (
      <section className={styles.mockPage}>
        <SectionHeading title="Quầy pha chế" description="Bảng mô phỏng realtime cho các phiếu pha chế đang hoạt động." />
        <div className={styles.queueGrid}>
          {barQueue.map((ticket) => (
            <article className={styles.queueCard} key={ticket.id}>
              <div className={styles.queueTop}>
                <strong>{ticket.orderNo}</strong>
                <span>{orderStatusText(ticket.status)}</span>
              </div>
              <p>
                {orderTypeLabels[ticket.type]} · {ticket.age}
              </p>
              {ticket.items.map((item) => (
                <div className={styles.queueLine} key={`${ticket.id}-${item.name}`}>
                  <span>{item.name}</span>
                  <small>
                    {item.variant} · {item.modifiers.join(", ")}
                  </small>
                  <strong>{barItemStatusText(item.status)}</strong>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (view === "Reports") {
    return (
      <section className={styles.mockPage}>
        <SectionHeading title="Báo cáo" description="Tổng quan doanh thu trong ngày bằng dữ liệu mô phỏng." />
        <div className={styles.metricGrid}>
          <Metric label="Doanh thu hôm nay" value={formatVnd(2364000)} />
          <Metric label="Số đơn" value="42" />
          <Metric label="Trung bình/đơn" value={formatVnd(56300)} />
          <Metric label="Tiền mặt / chuyển khoản" value="61% / 39%" />
        </div>
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span>Sản phẩm</span>
            <span>SL</span>
            <span>Doanh thu</span>
            <span>Xu hướng</span>
            <span>Trạng thái</span>
          </div>
          {menuItems.slice(0, 5).map((item, index) => (
            <div className={styles.tableRow} key={item.id}>
              <strong>{item.name}</strong>
              <span>{18 - index * 2}</span>
              <span>{formatVnd(item.variants[0].price * (18 - index * 2))}</span>
              <span>+{12 - index}%</span>
              <span>Đang bán</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (view === "Inventory") {
    return (
      <section className={styles.mockPage}>
        <SectionHeading title="Kho" description="Mô phỏng kiểm soát nguyên liệu và tình trạng bán món." />
        <div className={styles.inventoryGrid}>
          {["Hạt Arabica", "Sữa tươi", "Sữa yến mạch", "Ly 16oz", "Đường nâu", "Trân châu"].map((name, index) => (
            <article className={styles.inventoryCard} key={name}>
              <strong>{name}</strong>
              <span>{index === 2 ? "Sắp hết" : "Còn hàng"}</span>
              <div className={styles.stockBar}>
                <i style={{ width: `${index === 2 ? 28 : 74 - index * 7}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.mockPage}>
      <SectionHeading title="Cài đặt" description="Mô phỏng cấu hình cửa hàng, máy in và các tuỳ chọn vận hành." />
      <div className={styles.settingsGrid}>
        {["Thông tin cửa hàng", "Đăng nhập PIN nhân viên", "Máy in hoá đơn", "Máy in quầy bar", "Lịch sao lưu", "Bắt buộc mở ca"].map((setting) => (
          <button className={styles.settingRow} key={setting} type="button">
            <span>{setting}</span>
            <strong>Sẵn sàng</strong>
          </button>
        ))}
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

function BaristaStrip() {
  return (
    <section className={styles.baristaStrip}>
      <div className={styles.stripTitle}>
        <Coffee size={18} />
        <strong>Quầy pha chế</strong>
        <span>2 đơn</span>
      </div>
      {barQueue.map((ticket) => (
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

function defaultModifiers(item: MenuItem) {
  if (item.categoryId === "coffee") return ["50% đường"];
  if (item.categoryId === "soda" || item.categoryId === "fruit-tea") return ["Ít đá"];
  if (item.categoryId === "matcha" || item.categoryId === "yogurt" || item.categoryId === "milk-tea") return ["70% đường"];
  if (item.categoryId === "bread") return ["Làm nóng"];
  return ["Mặc định"];
}

function orderStatusText(status: string) {
  const map: Record<string, string> = {
    SENT: "Đã gửi",
    PREPARING: "Đang pha",
    READY: "Sẵn sàng",
    SERVED: "Đã phục vụ",
    CLOSED: "Đã đóng"
  };
  return map[status] ?? status;
}

function paymentStatusText(status: string) {
  const map: Record<string, string> = {
    UNPAID: "Chưa trả",
    PARTIAL: "Trả một phần",
    PAID: "Đã trả"
  };
  return map[status] ?? status;
}

function barItemStatusText(status: string) {
  const map: Record<string, string> = {
    Queued: "Đang chờ",
    Brewing: "Đang pha",
    Ready: "Xong"
  };
  return map[status] ?? status;
}
