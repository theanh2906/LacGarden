import type { Metadata } from "next";
import { renderDormPage } from "./DormPageContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dorm Management | Lac Garden",
  description: "Dorm occupancy, tenants, invoices, and rent collection"
};

export default async function DormPage() {
  return renderDormPage("overview", "/dorm");
}
