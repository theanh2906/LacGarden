import { renderDormPage } from "../DormPageContent";

export const dynamic = "force-dynamic";

export default function DormFinancePage() {
  return renderDormPage("finance", "/dorm/finance");
}
