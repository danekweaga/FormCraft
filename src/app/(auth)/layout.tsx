import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <Link
        href="/"
        className="mb-10 flex items-center gap-3 transition-opacity hover:opacity-80"
      >
        <BrandMark size={40} />
        <div>
          <p className="font-headline text-2xl font-bold leading-none text-on-background">
            FormCraft
          </p>
          <p className="text-[11px] font-medium uppercase tracking-widest text-secondary">
            Creator Intelligence
          </p>
        </div>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
