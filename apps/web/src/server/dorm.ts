import { DormBedStatus, DormInvoiceStatus, DormLeaseStatus, Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import type {
  CreateDormInvoiceInput,
  CreateDormLeaseInput,
  CreateDormPaymentInput,
  CreateDormRoomInput,
  CreateDormSiteInput,
  CreateDormTenantInput
} from "@/server/dorm-validation";
import type {
  DormInvoiceDto,
  DormLeaseOptionDto,
  DormSnapshot,
  DormSummaryDto,
  DormTenantDto
} from "@/types/dorm";

const ACTIVE_LEASE_STATUSES: DormLeaseStatus[] = ["ACTIVE", "NOTICE_GIVEN"];

export class DormServiceError extends Error {}

export async function getDormSnapshot(): Promise<DormSnapshot> {
  const db = getDb();
  const monthStart = startOfMonth(new Date());
  const [sites, tenants, activeLeases, invoices, allInvoices] = await Promise.all([
    db.dormSite.findMany({
      where: { isActive: true },
      include: {
        rooms: {
          orderBy: { code: "asc" },
          include: {
            beds: {
              orderBy: { code: "asc" },
              include: {
                leases: {
                  where: { status: { in: ACTIVE_LEASE_STATUSES } },
                  orderBy: { startDate: "desc" },
                  take: 1,
                  include: { tenant: { select: { fullName: true } } }
                }
              }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    db.dormTenant.findMany({
      include: {
        leases: {
          where: { status: { in: ACTIVE_LEASE_STATUSES } },
          orderBy: { startDate: "desc" },
          take: 1,
          include: { bed: { include: { room: { include: { site: true } } } } }
        }
      },
      orderBy: { fullName: "asc" }
    }),
    db.dormLease.findMany({
      where: { status: { in: ACTIVE_LEASE_STATUSES } },
      include: { tenant: true, bed: { include: { room: { include: { site: true } } } } },
      orderBy: [{ tenant: { fullName: "asc" } }]
    }),
    db.dormInvoice.findMany({
      include: { lease: { include: { tenant: true, bed: { include: { room: { include: { site: true } } } } } } },
      orderBy: [{ billingMonth: "desc" }, { dueDate: "asc" }],
      take: 80
    }),
    db.dormInvoice.findMany({
      where: { status: { not: "VOIDED" } },
      select: { billingMonth: true, totalVnd: true, paidVnd: true }
    })
  ]);

  const mappedSites = sites.map((site) => ({
    id: site.id,
    name: site.name,
    address: site.address,
    rooms: site.rooms.map((room) => ({
      id: room.id,
      siteId: room.siteId,
      code: room.code,
      name: room.name,
      status: room.status,
      beds: room.beds.map((bed) => ({
        id: bed.id,
        code: bed.code,
        status: bed.status,
        monthlyRentVnd: toNumber(bed.monthlyRentVnd),
        tenantName: bed.leases[0]?.tenant.fullName ?? null
      }))
    }))
  }));

  const mappedTenants: DormTenantDto[] = tenants.map((tenant) => {
    const lease = tenant.leases[0];
    return {
      id: tenant.id,
      fullName: tenant.fullName,
      phone: tenant.phone,
      identityNumber: tenant.identityNumber,
      activeLease: lease
        ? {
            id: lease.id,
            bedLabel: bedLabel(lease.bed.room.site.name, lease.bed.room.code, lease.bed.code),
            startDate: lease.startDate.toISOString(),
            monthlyRentVnd: toNumber(lease.monthlyRentVnd),
            dueDay: lease.dueDay
          }
        : null
    };
  });

  const mappedInvoices = invoices.map(mapInvoice);
  const summary = calculateSummary(mappedSites, allInvoices, monthStart);

  return {
    sites: mappedSites,
    tenants: mappedTenants,
    activeLeases: activeLeases.map(mapLeaseOption),
    invoices: mappedInvoices,
    summary
  };
}

export async function createDormSite(input: CreateDormSiteInput) {
  const site = await getDb().dormSite.create({ data: input });
  return { id: site.id, name: site.name };
}

export async function createDormRoom(input: CreateDormRoomInput) {
  const site = await getDb().dormSite.findFirst({ where: { id: input.siteId, isActive: true } });
  if (!site) throw new DormServiceError("Dorm site does not exist or is inactive.");

  const room = await getDb().dormRoom.create({
    data: {
      siteId: input.siteId,
      code: input.code,
      name: input.name,
      note: input.note,
      beds: {
        create: Array.from({ length: input.bedCount }, (_, index) => ({
          code: `G${index + 1}`,
          monthlyRentVnd: input.monthlyRentVnd
        }))
      }
    },
    include: { beds: true }
  });
  return { id: room.id, code: room.code, bedCount: room.beds.length };
}

export async function createDormTenant(input: CreateDormTenantInput) {
  const tenant = await getDb().dormTenant.create({ data: input });
  return { id: tenant.id, fullName: tenant.fullName };
}

export async function createDormLease(input: CreateDormLeaseInput, createdById: string) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const [tenant, bed] = await Promise.all([
      tx.dormTenant.findUnique({ where: { id: input.tenantId } }),
      tx.dormBed.findUnique({ where: { id: input.bedId } })
    ]);
    if (!tenant) throw new DormServiceError("Tenant does not exist.");
    if (!bed) throw new DormServiceError("Bed does not exist.");
    if (bed.status !== DormBedStatus.VACANT) throw new DormServiceError("Selected bed is not available.");

    const occupied = await tx.dormLease.findFirst({
      where: { bedId: bed.id, status: { in: ACTIVE_LEASE_STATUSES } },
      select: { id: true }
    });
    if (occupied) throw new DormServiceError("Selected bed already has an active lease.");

    const lease = await tx.dormLease.create({
      data: {
        tenantId: input.tenantId,
        bedId: input.bedId,
        startDate: asDate(input.startDate),
        dueDay: input.dueDay,
        monthlyRentVnd: input.monthlyRentVnd,
        depositVnd: input.depositVnd,
        note: input.note,
        createdById
      }
    });
    await tx.dormBed.update({ where: { id: bed.id }, data: { status: DormBedStatus.OCCUPIED } });
    return { id: lease.id };
  });
}

export async function createDormInvoice(input: CreateDormInvoiceInput) {
  const db = getDb();
  const lease = await db.dormLease.findFirst({
    where: { id: input.leaseId, status: { in: ACTIVE_LEASE_STATUSES } },
    include: { tenant: true }
  });
  if (!lease) throw new DormServiceError("Only active leases can be invoiced.");

  const billingMonth = startOfMonth(asDate(`${input.billingMonth}-01`));
  const lineItems = [
    { description: "Tiền thuê", amount: lease.monthlyRentVnd },
    { description: "Điện", amount: BigInt(input.electricityVnd) },
    { description: "Nước", amount: BigInt(input.waterVnd) },
    { description: "Phí dịch vụ", amount: BigInt(input.serviceVnd) },
    { description: "Khoản khác", amount: BigInt(input.otherVnd) }
  ].filter((item) => item.amount > 0n);
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0n);
  const invoiceNo = `DORM-${input.billingMonth.replace("-", "")}-${lease.id.slice(-6).toUpperCase()}`;

  const invoice = await db.dormInvoice.create({
    data: {
      leaseId: lease.id,
      invoiceNo,
      billingMonth,
      dueDate: asDate(input.dueDate),
      subtotalVnd: total,
      totalVnd: total,
      status: DormInvoiceStatus.ISSUED,
      note: input.note,
      issuedAt: new Date(),
      items: { create: lineItems.map((item, index) => ({ description: item.description, unitAmount: item.amount, lineTotal: item.amount, sortOrder: index })) }
    }
  });
  return { id: invoice.id, invoiceNo: invoice.invoiceNo };
}

export async function createDormPayment(invoiceId: string, input: CreateDormPaymentInput, receivedById: string) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const invoice = await tx.dormInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === DormInvoiceStatus.VOIDED) throw new DormServiceError("Invoice is not available for payment.");
    const balance = invoice.totalVnd - invoice.paidVnd;
    const amount = BigInt(input.amountVnd);
    if (amount > balance) throw new DormServiceError("Payment cannot exceed the remaining invoice balance.");

    await tx.dormPayment.create({
      data: {
        invoiceId,
        amountVnd: amount,
        method: input.method,
        reference: input.reference,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        note: input.note,
        receivedById
      }
    });
    const paidVnd = invoice.paidVnd + amount;
    const status = paidVnd === invoice.totalVnd ? DormInvoiceStatus.PAID : DormInvoiceStatus.PARTIAL;
    await tx.dormInvoice.update({ where: { id: invoiceId }, data: { paidVnd, status } });
    return { invoiceId, paidVnd: toNumber(paidVnd), status };
  });
}

function calculateSummary(sites: DormSnapshot["sites"], invoices: Array<{ billingMonth: Date; totalVnd: bigint; paidVnd: bigint }>, monthStart: Date): DormSummaryDto {
  const beds = sites.flatMap((site) => site.rooms.flatMap((room) => room.beds));
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((bed) => bed.status === "OCCUPIED").length;
  const currentMonthInvoices = invoices.filter((invoice) => invoice.billingMonth.getTime() === monthStart.getTime());
  return {
    totalBeds,
    occupiedBeds,
    vacantBeds: beds.filter((bed) => bed.status === "VACANT").length,
    occupancyPercent: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    monthRevenueVnd: currentMonthInvoices.reduce((sum, invoice) => sum + toNumber(invoice.totalVnd), 0),
    monthCollectedVnd: currentMonthInvoices.reduce((sum, invoice) => sum + toNumber(invoice.paidVnd), 0),
    outstandingVnd: invoices.reduce((sum, invoice) => sum + toNumber(invoice.totalVnd) - toNumber(invoice.paidVnd), 0)
  };
}

function mapLeaseOption(
  lease: Prisma.DormLeaseGetPayload<{
    include: { tenant: true; bed: { include: { room: { include: { site: true } } } } };
  }>
): DormLeaseOptionDto {
  return {
    id: lease.id,
    tenantName: lease.tenant.fullName,
    bedLabel: bedLabel(lease.bed.room.site.name, lease.bed.room.code, lease.bed.code),
    monthlyRentVnd: toNumber(lease.monthlyRentVnd),
    dueDay: lease.dueDay
  };
}

function mapInvoice(
  invoice: Prisma.DormInvoiceGetPayload<{
    include: { lease: { include: { tenant: true; bed: { include: { room: { include: { site: true } } } } } } };
  }>
): DormInvoiceDto {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    billingMonth: invoice.billingMonth.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    tenantName: invoice.lease.tenant.fullName,
    bedLabel: bedLabel(invoice.lease.bed.room.site.name, invoice.lease.bed.room.code, invoice.lease.bed.code),
    totalVnd: toNumber(invoice.totalVnd),
    paidVnd: toNumber(invoice.paidVnd),
    balanceVnd: toNumber(invoice.totalVnd - invoice.paidVnd),
    status: invoice.status
  };
}

function bedLabel(site: string, room: string, bed: string) {
  return `${site} · ${room}/${bed}`;
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toNumber(value: bigint) {
  return Number(value);
}

export function getDormErrorMessage(error: unknown) {
  if (error instanceof DormServiceError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "A record with the same unique value already exists.";
  return "Dorm operation could not be completed.";
}
