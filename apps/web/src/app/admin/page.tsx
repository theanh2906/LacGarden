import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { AdminHub } from "./AdminHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lac Garden Admin | Module Hub",
  description: "Choose a Lac Garden management module"
};

export default async function AdminPage() {
  const session = await requirePagePermission("settings:manage", "/admin");
  return <AdminHub displayName={session.staff.displayName} />;
}
