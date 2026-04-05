import type { Metadata } from "next";
import type React from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ZapierChatbot } from "@/components/zapier-chatbot";

export const metadata: Metadata = {
  title: {
    template: "%s | Crossover Apparel",
    default: "Crossover Apparel — Premium Custom Teamwear",
  },
  description:
    "Crossover Apparel crafts high-quality custom jerseys, t-shirts, polo shirts, and warmers for clubs, schools, and performance teams.",
  openGraph: {
    siteName: "Crossover Apparel",
    title: "Crossover Apparel — Premium Custom Teamwear",
    description:
      "High-quality custom teamwear engineered for identity. Jerseys, t-shirts, warmers, and more.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff_0%,#f7f7f7_55%,#f3f3f3_100%)]">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <ZapierChatbot />
    </div>
  );
}
