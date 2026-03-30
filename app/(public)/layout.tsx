import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff_0%,#f7f7f7_55%,#f3f3f3_100%)]">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
