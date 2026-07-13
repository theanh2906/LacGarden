import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { getDormSnapshot } from "@/server/dorm";
import type { DormSnapshot } from "@/types/dorm";
import { DormAdmin } from "./DormAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dorm Management | Lac Garden",
  description: "Dorm occupancy, tenants, invoices, and rent collection"
};

const emptySnapshot: DormSnapshot = {
  sites: [],
  tenants: [],
  activeLeases: [],
  invoices: [],
  summary: { totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, occupancyPercent: 0, monthRevenueVnd: 0, monthCollectedVnd: 0, outstandingVnd: 0 }
};

export default async function DormPage() {
  await requirePagePermission("dorm:manage", "/dorm");
  try {
    return <DormAdmin initialSnapshot={await getDormSnapshot()} />;
  } catch (error) {
    console.info("[dorm] Failed to load dashboard", error);
    return <DormAdmin initialSnapshot={emptySnapshot} />;
  }
}
