import { Recorder } from "@/components/recorder";
import { productOptions } from "@/lib/stats";

export default function SalesPage() {
  return <Recorder kind="sale" products={productOptions()} />;
}
