import { PrimaryNavLinks, SecondaryNavLinks } from "./nav-links";
import { MaterialIcon } from "./material-icon";

export function AppSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-dvh w-64 flex-col overflow-hidden border-r border-outline-variant/15 bg-surface px-3 py-5 md:flex">
      <div className="mb-5 flex shrink-0 items-center gap-3 px-3">
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

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-6 pr-1">
        <PrimaryNavLinks />
        <SecondaryNavLinks />
      </div>
    </aside>
  );
}
