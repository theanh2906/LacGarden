import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { getPayrollSnapshot } from "@/server/payroll";
import { payrollQuerySchema } from "@/server/payroll-validation";
import type { PayrollSnapshotDto } from "@/types/payroll";
import { PayrollAdmin } from "./PayrollAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payroll | Lac Garden POS",
  description: "Payroll calculation, review, and export for approved timesheets"
};

type PayrollPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  await requirePagePermission("payroll:manage", "/payroll");
  const query = payrollQuerySchema.parse(normalizeQuery(await searchParams));
  let snapshot: PayrollSnapshotDto;

  try {
    snapshot = await getPayrollSnapshot(query);
  } catch (error) {
    console.info("[payroll] Failed to load payroll", error);
    snapshot = await getPayrollSnapshot({});
  }

  return <PayrollAdmin initialSnapshot={snapshot} />;
}

function normalizeQuery(params: Record<string, string | string[] | undefined>) {
  const entries = Object.entries(params).flatMap(([key, value]) => {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw ? [[key, raw]] : [];
  });
  return Object.fromEntries(entries);
}
