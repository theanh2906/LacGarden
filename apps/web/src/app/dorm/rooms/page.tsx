import { renderDormPage } from "../DormPageContent";

export const dynamic = "force-dynamic";

export default function DormRoomsPage() {
  return renderDormPage("rooms", "/dorm/rooms");
}
