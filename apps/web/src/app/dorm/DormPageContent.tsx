import { requirePagePermission } from "@/server/auth";
import { getDormSnapshot } from "@/server/dorm";
import type { DormSnapshot } from "@/types/dorm";
import type { DormSection } from "./DormAdmin";
import { DormAdmin } from "./DormAdmin";

const emptySnapshot: DormSnapshot = {
  sites: [],
  tenants: [],
  activeLeases: [],
  invoices: [],
  summary: { totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, occupancyPercent: 0, monthRevenueVnd: 0, monthCollectedVnd: 0, outstandingVnd: 0 }
};

export async function renderDormPage(section: DormSection, path: string) {
  await requirePagePermission("dorm:manage", path);
  try {
    return <DormAdmin initialSnapshot={await getDormSnapshot(section)} section={section} />;
  } catch (error) {
    console.info(`[dorm] Failed to load ${section} page`, error);
    return <DormAdmin initialSnapshot={emptySnapshot} section={section} />;
  }
}
