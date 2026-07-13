-- Additive migration for the Dorm management module.
CREATE TYPE "dorm_room_status" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE "dorm_bed_status" AS ENUM ('VACANT', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');
CREATE TYPE "dorm_lease_status" AS ENUM ('ACTIVE', 'NOTICE_GIVEN', 'ENDED', 'CANCELLED');
CREATE TYPE "dorm_invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOIDED');
CREATE TYPE "dorm_payment_method" AS ENUM ('CASH', 'BANK_TRANSFER', 'QR', 'CARD', 'OTHER');

CREATE TABLE "dorm_sites" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "address" TEXT,
  "note" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_rooms" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "site_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "dorm_room_status" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_beds" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "room_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "status" "dorm_bed_status" NOT NULL DEFAULT 'VACANT',
  "monthly_rent_vnd" BIGINT NOT NULL DEFAULT 0,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_beds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_tenants" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "full_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "identity_number" TEXT,
  "emergency_contact" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_leases" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "bed_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "due_day" INTEGER NOT NULL DEFAULT 5,
  "monthly_rent_vnd" BIGINT NOT NULL,
  "deposit_vnd" BIGINT NOT NULL DEFAULT 0,
  "status" "dorm_lease_status" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_leases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_invoices" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "lease_id" UUID NOT NULL,
  "invoice_no" TEXT NOT NULL,
  "billing_month" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "subtotal_vnd" BIGINT NOT NULL DEFAULT 0,
  "total_vnd" BIGINT NOT NULL DEFAULT 0,
  "paid_vnd" BIGINT NOT NULL DEFAULT 0,
  "status" "dorm_invoice_status" NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "issued_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_invoice_items" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "invoice_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_amount" BIGINT NOT NULL,
  "line_total" BIGINT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dorm_payments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "invoice_id" UUID NOT NULL,
  "amount_vnd" BIGINT NOT NULL,
  "method" "dorm_payment_method" NOT NULL,
  "reference" TEXT,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_by_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dorm_sites_name_uidx" ON "dorm_sites"("name");
CREATE INDEX "dorm_sites_isActive_name_idx" ON "dorm_sites"("is_active", "name");
CREATE UNIQUE INDEX "dorm_rooms_siteId_code_uidx" ON "dorm_rooms"("site_id", "code");
CREATE INDEX "dorm_rooms_siteId_status_idx" ON "dorm_rooms"("site_id", "status");
CREATE UNIQUE INDEX "dorm_beds_roomId_code_uidx" ON "dorm_beds"("room_id", "code");
CREATE INDEX "dorm_beds_roomId_status_idx" ON "dorm_beds"("room_id", "status");
CREATE INDEX "dorm_tenants_fullName_idx" ON "dorm_tenants"("full_name");
CREATE INDEX "dorm_tenants_phone_idx" ON "dorm_tenants"("phone");
CREATE INDEX "dorm_leases_tenantId_status_idx" ON "dorm_leases"("tenant_id", "status");
CREATE INDEX "dorm_leases_bedId_status_idx" ON "dorm_leases"("bed_id", "status");
CREATE INDEX "dorm_leases_status_startDate_idx" ON "dorm_leases"("status", "start_date");
CREATE UNIQUE INDEX "dorm_invoices_invoiceNo_uidx" ON "dorm_invoices"("invoice_no");
CREATE UNIQUE INDEX "dorm_invoices_leaseId_billingMonth_uidx" ON "dorm_invoices"("lease_id", "billing_month");
CREATE INDEX "dorm_invoices_status_dueDate_idx" ON "dorm_invoices"("status", "due_date");
CREATE INDEX "dorm_invoices_billingMonth_idx" ON "dorm_invoices"("billing_month");
CREATE INDEX "dorm_invoice_items_invoiceId_sortOrder_idx" ON "dorm_invoice_items"("invoice_id", "sort_order");
CREATE INDEX "dorm_payments_invoiceId_receivedAt_idx" ON "dorm_payments"("invoice_id", "received_at");
CREATE INDEX "dorm_payments_receivedAt_idx" ON "dorm_payments"("received_at");

ALTER TABLE "dorm_rooms" ADD CONSTRAINT "dorm_rooms_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "dorm_sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "dorm_beds" ADD CONSTRAINT "dorm_beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "dorm_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "dorm_leases" ADD CONSTRAINT "dorm_leases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "dorm_tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "dorm_leases" ADD CONSTRAINT "dorm_leases_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "dorm_beds"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "dorm_leases" ADD CONSTRAINT "dorm_leases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "dorm_invoices" ADD CONSTRAINT "dorm_invoices_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "dorm_leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "dorm_invoice_items" ADD CONSTRAINT "dorm_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "dorm_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "dorm_payments" ADD CONSTRAINT "dorm_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "dorm_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "dorm_payments" ADD CONSTRAINT "dorm_payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
