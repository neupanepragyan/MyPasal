import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** The address a phone should open: this machine's Wi-Fi IP when running locally. */
async function phoneUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const [hostname, port = "3000"] = host.split(/:(?=\d+$)/);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return `${proto}://${host}`;

  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal);
  return lan ? `http://${lan.address}:${port}` : null;
}

/** Desktop-only (mouse + wide screen) nudge to switch to the phone. */
export async function PhonePanel() {
  const url = await phoneUrl();
  if (!url) return null;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1 });

  return (
    <aside className="sticky top-6 mt-16 hidden h-fit w-60 shrink-0 rounded-2xl bg-white p-5 shadow-sm lg:[@media(pointer:fine)]:block">
      <p className="font-semibold">Use Pasal on your phone</p>
      <p className="mt-1 text-sm text-stone-500">
        Snap stock photos and speak your sales. Scan with your phone camera
        {url.startsWith("http://") && " while on the same Wi-Fi"}.
      </p>
      <div className="mt-4" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-2 break-all text-center font-mono text-xs text-stone-500">{url}</p>
    </aside>
  );
}
