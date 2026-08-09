import { PrimaryNavLinks, SecondaryNavLinks } from "./nav-links";
import { MaterialIcon } from "./material-icon";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-outline-variant/15 bg-surface px-4 py-12 md:flex">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-container text-white">
          <MaterialIcon name="workspace_premium" className="text-lg text-white" />
        </div>
        <div>
          <h1 className="font-headline text-2xl font-bold leading-none text-on-background">
            FormCraft
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-widest text-secondary">
            Creator Intelligence
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <PrimaryNavLinks />
      </div>

      <Button className="mx-2 mt-4 mb-6" disabled title="Coming soon">
        <MaterialIcon name="add" className="text-sm" />
        New
      </Button>

      <SecondaryNavLinks />
    </aside>
  );
}
