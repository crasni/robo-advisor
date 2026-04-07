import { LandingExperience } from "@/components/landing-experience";
import { latestSummary, timeSeries, treasuryEvents } from "@/lib/mnav-data";

export default function HomePage() {
  const latest = latestSummary();
  const firstRecord = timeSeries[0] ?? null;

  return (
    <LandingExperience
      latest={latest}
      firstDate={firstRecord?.date ?? null}
      eventCount={treasuryEvents.length}
    />
  );
}
