import { BrandMark } from "@/components/brand/brand-mark";
import { PrimaryNavLinks, SecondaryNavLinks } from "./nav-links";

export function AppSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-dvh w-64 flex-col overflow-hidden border-r border-outline-variant/15 bg-surface px-3 py-5 md:flex">
      <div className="mb-5 flex shrink-0 items-center gap-3 px-3">
        <BrandMark size={32} />
        <div>
          <h1 className="font-sans text-xl font-bold leading-none tracking-tight text-on-background">
            FormCraft
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-widest text-secondary">
            Creator Intelligence
          </p>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-6 pr-1">
        <PrimaryNavLinks />
        <SecondaryNavLinks />
      </div>
    </aside>
  );
}
