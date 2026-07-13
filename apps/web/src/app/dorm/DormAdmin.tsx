"use client";

import { ArrowLeft, BedDouble, Building2, Coffee, FileText, Home, LayoutDashboard, Loader2, Plus, ReceiptText, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { DormInvoiceDto, DormPaymentMethod, DormSnapshot } from "@/types/dorm";
import styles from "./DormAdmin.module.scss";

export type DormSection = "overview" | "rooms" | "tenants" | "finance";
type Props = { initialSnapshot: DormSnapshot; section: DormSection };

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const monthValue = new Date().toISOString().slice(0, 7);
const dateValue = new Date().toISOString().slice(0, 10);

export function DormAdmin({ initialSnapshot, section }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [notice, setNotice] = useState("Sẵn sàng quản lý cơ sở, khách thuê và dòng tiền dorm.");
  const [pending, setPending] = useState<string | null>(null);
  const vacantBeds = useMemo(
    () => snapshot.sites.flatMap((site) => site.rooms.flatMap((room) => room.beds.filter((bed) => bed.status === "VACANT").map((bed) => ({ id: bed.id, label: `${site.name} · ${room.code}/${bed.code}`, rent: bed.monthlyRentVnd })))),
    [snapshot.sites]
  );

  async function refresh() {
    const response = await fetch("/api/dorm", { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<DormSnapshot>;
    if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không tải được dữ liệu dorm.");
    setSnapshot(payload.data);
  }

  async function submit(event: FormEvent<HTMLFormElement>, url: string, action: string, success: string) {
    event.preventDefault();
    setPending(action);
    try {
      const form = event.currentTarget;
      const body: Record<string, string> = {};
      new FormData(form).forEach((value, key) => {
        body[key] = String(value);
      });
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok) throw new Error(payload.error?.message ?? "Không thể lưu dữ liệu.");
      form.reset();
      await refresh();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Điều hướng Dorm">
          <a className={styles.brandMark} href="/" aria-label="Quay lại POS"><Coffee size={27} /></a>
          <DormNavItem href="/dorm" active={section === "overview"} icon={<LayoutDashboard size={21} />} label="Tổng quan" />
          <DormNavItem href="/dorm/rooms" active={section === "rooms"} icon={<BedDouble size={21} />} label="Phòng" />
          <DormNavItem href="/dorm/tenants" active={section === "tenants"} icon={<Users size={21} />} label="Khách thuê" />
          <DormNavItem href="/dorm/finance" active={section === "finance"} icon={<ReceiptText size={21} />} label="Tài chính" />
          <a className={styles.sidebarBack} href="/"><ArrowLeft size={17} /> POS</a>
        </aside>

        <section className={styles.workspace}>
          <header className={styles.topbar}>
            <div className={styles.storeBlock}>
              <span>LAC GARDEN / DORM</span>
              <strong>Quản lý Dorm</strong>
              <small>Cơ sở, sức chứa, khách thuê và dòng tiền</small>
            </div>
            <button className={styles.secondaryButton} disabled={busy} onClick={() => void refresh().then(() => setNotice("Đã làm mới dữ liệu dorm.")).catch((error) => setNotice(error.message))}>
              {pending === "refresh" ? <Loader2 className={styles.spin} size={17} /> : <Home size={17} />} Làm mới
            </button>
          </header>

          <div className={styles.content}>

      <section id="overview" className={styles.metrics}>
        <Metric icon={<BedDouble size={20} />} label="Lấp đầy" value={`${snapshot.summary.occupancyPercent}%`} detail={`${snapshot.summary.occupiedBeds}/${snapshot.summary.totalBeds} giường`} />
        <Metric icon={<Home size={20} />} label="Giường trống" value={String(snapshot.summary.vacantBeds)} detail="Sẵn sàng ký hợp đồng" />
        <Metric icon={<ReceiptText size={20} />} label="Doanh thu tháng" value={currency.format(snapshot.summary.monthRevenueVnd)} detail="Hóa đơn đã phát hành" />
        <Metric icon={<FileText size={20} />} label="Đã thu tháng" value={currency.format(snapshot.summary.monthCollectedVnd)} detail="Từ các hóa đơn tháng này" />
        <Metric icon={<Users size={20} />} label="Công nợ" value={currency.format(snapshot.summary.outstandingVnd)} detail="Tất cả hóa đơn chưa tất toán" warn />
      </section>

      <p className={styles.notice}>{busy && <Loader2 className={styles.spin} size={17} />} {notice}</p>

      {section === "rooms" ? <section className={styles.forms}>
        <FormCard title="1. Thêm cơ sở" icon={<Building2 size={19} />}>
          <form onSubmit={(event) => void submit(event, "/api/dorm/sites", "site", "Đã thêm cơ sở dorm.")}>
            <Field label="Tên cơ sở"><input name="name" required placeholder="VD: Lac Garden Dorm 1" /></Field>
            <Field label="Địa chỉ"><input name="address" placeholder="Địa chỉ cơ sở" /></Field>
            <button className={styles.primaryButton} disabled={busy}><Plus size={16} /> Tạo cơ sở</button>
          </form>
        </FormCard>

        <FormCard title="2. Thêm phòng & giường" icon={<BedDouble size={19} />}>
          <form onSubmit={(event) => void submit(event, "/api/dorm/rooms", "room", "Đã tạo phòng và các giường.")}>
            <Field label="Cơ sở"><select name="siteId" required defaultValue=""><option value="" disabled>Chọn cơ sở</option>{snapshot.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
            <div className={styles.splitFields}><Field label="Mã phòng"><input name="code" required placeholder="P101" /></Field><Field label="Tên hiển thị"><input name="name" required placeholder="Phòng 101" /></Field></div>
            <div className={styles.splitFields}><Field label="Số giường"><input name="bedCount" type="number" min="1" defaultValue="4" required /></Field><Field label="Giá/giường/tháng"><input name="monthlyRentVnd" type="number" min="0" defaultValue="0" required /></Field></div>
            <button className={styles.primaryButton} disabled={busy || !snapshot.sites.length}><Plus size={16} /> Tạo phòng</button>
          </form>
        </FormCard>
      </section> : null}

      {section === "tenants" ? <section className={styles.forms}>
        <FormCard title="3. Thêm khách thuê" icon={<Users size={19} />}>
          <form onSubmit={(event) => void submit(event, "/api/dorm/tenants", "tenant", "Đã lưu hồ sơ khách thuê.")}>
            <div className={styles.splitFields}><Field label="Họ tên"><input name="fullName" required placeholder="Nguyễn Văn A" /></Field><Field label="Số điện thoại"><input name="phone" required placeholder="090..." /></Field></div>
            <div className={styles.splitFields}><Field label="CCCD"><input name="identityNumber" placeholder="Tùy chọn" /></Field><Field label="Liên hệ khẩn"><input name="emergencyContact" placeholder="Tùy chọn" /></Field></div>
            <button className={styles.primaryButton} disabled={busy}><Plus size={16} /> Lưu khách thuê</button>
          </form>
        </FormCard>

        <FormCard title="4. Ký hợp đồng" icon={<FileText size={19} />}>
          <form onSubmit={(event) => void submit(event, "/api/dorm/leases", "lease", "Đã ký hợp đồng và cập nhật giường sang đang thuê.")}>
            <Field label="Khách thuê"><select name="tenantId" required defaultValue=""><option value="" disabled>Chọn khách thuê</option>{snapshot.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName} · {tenant.phone}</option>)}</select></Field>
            <Field label="Giường trống"><select name="bedId" required defaultValue=""><option value="" disabled>Chọn giường</option>{vacantBeds.map((bed) => <option key={bed.id} value={bed.id}>{bed.label} · {currency.format(bed.rent)}</option>)}</select></Field>
            <div className={styles.splitFields}><Field label="Ngày bắt đầu"><input name="startDate" type="date" required defaultValue={dateValue} /></Field><Field label="Ngày hạn thu"><input name="dueDay" type="number" min="1" max="28" required defaultValue="5" /></Field></div>
            <div className={styles.splitFields}><Field label="Giá thuê/tháng"><input name="monthlyRentVnd" type="number" min="0" required /></Field><Field label="Tiền cọc"><input name="depositVnd" type="number" min="0" defaultValue="0" required /></Field></div>
            <button className={styles.primaryButton} disabled={busy || !snapshot.tenants.length || !vacantBeds.length}><Plus size={16} /> Tạo hợp đồng</button>
          </form>
        </FormCard>
      </section> : null}

      {section === "tenants" ? <section className={styles.tablePanel}>
        <div className={styles.panelTitle}><Users size={19} /> Danh sách khách thuê</div>
        <table><thead><tr><th>Khách thuê</th><th>Điện thoại</th><th>CCCD</th><th>Phòng / giường</th><th>Giá thuê</th><th>Ngày vào</th></tr></thead>
          <tbody>{snapshot.tenants.length ? snapshot.tenants.map((tenant) => <tr key={tenant.id}><td><strong>{tenant.fullName}</strong></td><td>{tenant.phone}</td><td>{tenant.identityNumber ?? "—"}</td><td>{tenant.activeLease?.bedLabel ?? "Chưa xếp giường"}</td><td>{tenant.activeLease ? currency.format(tenant.activeLease.monthlyRentVnd) : "—"}</td><td>{tenant.activeLease?.startDate.slice(0, 10) ?? "—"}</td></tr>) : <tr><td colSpan={6} className={styles.empty}>Chưa có khách thuê nào.</td></tr>}</tbody>
        </table>
      </section> : null}

      {section === "overview" || section === "rooms" ? <section className={styles.board}>
        <div className={styles.panelTitle}><BedDouble size={19} /> Sơ đồ giường</div>
        {!snapshot.sites.length ? <p className={styles.empty}>Chưa có cơ sở. Bắt đầu bằng cách thêm cơ sở đầu tiên.</p> : snapshot.sites.map((site) => (
          <article key={site.id} className={styles.siteCard}>
            <h2>{site.name}</h2>{site.address && <p>{site.address}</p>}
            <div className={styles.roomGrid}>{site.rooms.map((room) => <div className={styles.room} key={room.id}><strong>{room.code}</strong><span>{room.name}</span><div className={styles.beds}>{room.beds.map((bed) => <span key={bed.id} className={`${styles.bed} ${styles[`bed${bed.status}`]}`} title={bed.tenantName ?? "Trống"}>{bed.code} {bed.tenantName ? `· ${bed.tenantName}` : "· Trống"}</span>)}</div></div>)}</div>
          </article>
        ))}
      </section> : null}

      {section === "finance" ? <section className={styles.financeGrid}>
        <FormCard title="5. Phát hành hóa đơn tháng" icon={<ReceiptText size={19} />}>
          <form onSubmit={(event) => void submit(event, "/api/dorm/invoices", "invoice", "Đã phát hành hóa đơn tiền thuê.")}>
            <Field label="Hợp đồng"><select name="leaseId" required defaultValue=""><option value="" disabled>Chọn hợp đồng đang hiệu lực</option>{snapshot.activeLeases.map((lease) => <option key={lease.id} value={lease.id}>{lease.tenantName} · {lease.bedLabel}</option>)}</select></Field>
            <div className={styles.splitFields}><Field label="Kỳ hóa đơn"><input name="billingMonth" type="month" defaultValue={monthValue} required /></Field><Field label="Hạn thanh toán"><input name="dueDate" type="date" defaultValue={dateValue} required /></Field></div>
            <div className={styles.fourFields}><Field label="Điện"><input name="electricityVnd" type="number" min="0" defaultValue="0" /></Field><Field label="Nước"><input name="waterVnd" type="number" min="0" defaultValue="0" /></Field><Field label="Dịch vụ"><input name="serviceVnd" type="number" min="0" defaultValue="0" /></Field><Field label="Khác"><input name="otherVnd" type="number" min="0" defaultValue="0" /></Field></div>
            <button className={styles.primaryButton} disabled={busy || !snapshot.activeLeases.length}><ReceiptText size={16} /> Phát hành hóa đơn</button>
          </form>
        </FormCard>
        <FormCard title="6. Ghi nhận thanh toán" icon={<ReceiptText size={19} />}>
          <form onSubmit={(event) => void submit(event, `/api/dorm/invoices/${String(new FormData(event.currentTarget).get("invoiceId"))}/payments`, "payment", "Đã ghi nhận thanh toán.")}>
            <Field label="Hóa đơn còn nợ"><select name="invoiceId" required defaultValue=""><option value="" disabled>Chọn hóa đơn</option>{snapshot.invoices.filter((invoice) => invoice.balanceVnd > 0).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo} · {invoice.tenantName} · còn {currency.format(invoice.balanceVnd)}</option>)}</select></Field>
            <div className={styles.splitFields}><Field label="Số tiền"><input name="amountVnd" type="number" min="1" required /></Field><Field label="Phương thức"><select name="method" defaultValue="BANK_TRANSFER">{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field></div>
            <Field label="Mã giao dịch"><input name="reference" placeholder="Tùy chọn" /></Field>
            <button className={styles.primaryButton} disabled={busy || !snapshot.invoices.some((invoice) => invoice.balanceVnd > 0)}><ReceiptText size={16} /> Xác nhận thu tiền</button>
          </form>
        </FormCard>
      </section> : null}

      {section === "overview" || section === "finance" ? <section className={styles.tablePanel}>
        <div className={styles.panelTitle}><ReceiptText size={19} /> Hóa đơn gần đây</div>
        <table><thead><tr><th>Mã</th><th>Khách / giường</th><th>Kỳ</th><th>Hạn</th><th>Tổng</th><th>Đã thu</th><th>Còn lại</th><th>Trạng thái</th></tr></thead>
          <tbody>{snapshot.invoices.length ? snapshot.invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />) : <tr><td colSpan={8} className={styles.empty}>Chưa có hóa đơn nào.</td></tr>}</tbody>
        </table>
      </section> : null}
          </div>

          <nav className={styles.bottomNav} aria-label="Điều hướng Dorm mobile">
            <DormNavItem href="/dorm" active={section === "overview"} icon={<LayoutDashboard size={20} />} label="Tổng quan" />
            <DormNavItem href="/dorm/rooms" active={section === "rooms"} icon={<BedDouble size={20} />} label="Phòng" />
            <DormNavItem href="/dorm/tenants" active={section === "tenants"} icon={<Users size={20} />} label="Khách thuê" />
            <DormNavItem href="/dorm/finance" active={section === "finance"} icon={<ReceiptText size={20} />} label="Tài chính" />
          </nav>
        </section>
      </div>
    </main>
  );
}

function DormNavItem({ href, active = false, icon, label }: { href: string; active?: boolean; icon: ReactNode; label: string }) {
  return <Link className={`${styles.navItem} ${active ? styles.activeNav : ""}`} href={href}>{icon}<span>{label}</span></Link>;
}

function Metric({ icon, label, value, detail, warn = false }: { icon: ReactNode; label: string; value: string; detail: string; warn?: boolean }) {
  return <article className={`${styles.metric} ${warn ? styles.warnMetric : ""}`}><span>{icon} {label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function FormCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className={styles.card}><h2>{icon} {title}</h2>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

function InvoiceRow({ invoice }: { invoice: DormInvoiceDto }) {
  return <tr><td><strong>{invoice.invoiceNo}</strong></td><td><strong>{invoice.tenantName}</strong><small>{invoice.bedLabel}</small></td><td>{invoice.billingMonth.slice(0, 7)}</td><td>{invoice.dueDate.slice(0, 10)}</td><td>{currency.format(invoice.totalVnd)}</td><td>{currency.format(invoice.paidVnd)}</td><td className={invoice.balanceVnd ? styles.debt : ""}>{currency.format(invoice.balanceVnd)}</td><td><span className={`${styles.status} ${styles[`status${invoice.status}`]}`}>{invoice.status === "PAID" ? "Đã thu" : invoice.status === "PARTIAL" ? "Thu một phần" : "Chờ thu"}</span></td></tr>;
}

const paymentMethods: Array<{ value: DormPaymentMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Chuyển khoản" }, { value: "QR", label: "QR" }, { value: "CASH", label: "Tiền mặt" }, { value: "CARD", label: "Thẻ" }, { value: "OTHER", label: "Khác" }
];

type ApiResponse<T> = { data?: T; error?: { message?: string } };
