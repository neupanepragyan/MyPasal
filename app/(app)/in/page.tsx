import { Recorder } from "@/components/recorder";
import { productOptions } from "@/lib/stats";

export default function StockInPage() {
  return <Recorder kind="in" products={productOptions()} />;
}
