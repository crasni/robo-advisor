import { DashboardView } from "@/components/dashboard-view";
import { rangeConfig, timeSeries, treasuryEvents } from "@/lib/mnav-data";

export default function DashboardPage() {
  return <DashboardView data={timeSeries} ranges={rangeConfig} events={treasuryEvents} />;
}
