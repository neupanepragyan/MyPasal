import { logout } from "@/app/actions";
import { Nav } from "@/components/nav";
import { PhonePanel } from "@/components/phone-panel";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex max-w-4xl justify-center gap-10 px-4">
      <div className="w-full max-w-md pb-28">
        <header className="flex items-center justify-between py-4">
          <span className="text-xl font-bold tracking-tight text-emerald-700">Pasal</span>
          <form action={logout}>
            <button className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-200">Lock</button>
          </form>
        </header>
        <main>{children}</main>
      </div>
      <PhonePanel />
      <Nav />
    </div>
  );
}
