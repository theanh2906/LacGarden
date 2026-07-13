export type DormBedStatus = "VACANT" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
export type DormLeaseStatus = "ACTIVE" | "NOTICE_GIVEN" | "ENDED" | "CANCELLED";
export type DormInvoiceStatus = "DRAFT" | "ISSUED" | "PARTIAL" | "PAID" | "VOIDED";
export type DormPaymentMethod = "CASH" | "BANK_TRANSFER" | "QR" | "CARD" | "OTHER";

export type DormBedDto = {
  id: string;
  code: string;
  status: DormBedStatus;
  monthlyRentVnd: number;
  tenantName: string | null;
};

export type DormRoomDto = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  beds: DormBedDto[];
};

export type DormSiteDto = {
  id: string;
  name: string;
  address: string | null;
  rooms: DormRoomDto[];
};

export type DormTenantDto = {
  id: string;
  fullName: string;
  phone: string;
  identityNumber: string | null;
  activeLease: {
    id: string;
    bedLabel: string;
    startDate: string;
    monthlyRentVnd: number;
    dueDay: number;
  } | null;
};

export type DormLeaseOptionDto = {
  id: string;
  tenantName: string;
  bedLabel: string;
  monthlyRentVnd: number;
  dueDay: number;
};

export type DormInvoiceDto = {
  id: string;
  invoiceNo: string;
  billingMonth: string;
  dueDate: string;
  tenantName: string;
  bedLabel: string;
  totalVnd: number;
  paidVnd: number;
  balanceVnd: number;
  status: DormInvoiceStatus;
};

export type DormSummaryDto = {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPercent: number;
  monthRevenueVnd: number;
  monthCollectedVnd: number;
  outstandingVnd: number;
};

export type DormSnapshot = {
  sites: DormSiteDto[];
  tenants: DormTenantDto[];
  activeLeases: DormLeaseOptionDto[];
  invoices: DormInvoiceDto[];
  summary: DormSummaryDto;
};
