import { PosDemo, type DemoView } from "@/components/pos-demo/PosDemo";

const demoViews: DemoView[] = ["POS", "Orders", "Queue", "Reports", "Inventory", "Settings"];

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const initialView = demoViews.includes(view as DemoView) ? (view as DemoView) : "POS";
  return <PosDemo initialView={initialView} />;
}
