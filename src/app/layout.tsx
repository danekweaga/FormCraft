import type { Metadata } from "next";
import { Hanken_Grotesk, Libre_Caslon_Text } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const libre = Libre_Caslon_Text({
  variable: "--font-libre",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FormCraft | Creator Intelligence",
  description:
    "FormCraft helps creators research, analyze, teach, plan, and write with personal content intelligence.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${libre.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-surface font-sans text-on-surface">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
