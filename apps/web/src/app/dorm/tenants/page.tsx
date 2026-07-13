import { renderDormPage } from "../DormPageContent";

export const dynamic = "force-dynamic";

export default function DormTenantsPage() {
  return renderDormPage("tenants", "/dorm/tenants");
}
