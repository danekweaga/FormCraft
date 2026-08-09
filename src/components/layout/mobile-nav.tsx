"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PrimaryNavLinks, SecondaryNavLinks } from "./nav-links";
import { MaterialIcon } from "./material-icon";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MaterialIcon name="workspace_premium" className="text-primary" />
            FormCraft
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col gap-6 overflow-y-auto pb-10">
          <PrimaryNavLinks onNavigate={() => setOpen(false)} />
          <SecondaryNavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
