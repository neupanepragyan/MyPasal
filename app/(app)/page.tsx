import { Recorder } from "@/components/recorder";
import { RecentEntries } from "@/components/recent-entries";
import { productOptions } from "@/lib/stats";

export default function RecordPage() {
  return (
    <Recorder products={productOptions()}>
      <RecentEntries />
    </Recorder>
  );
}
