import { DashboardView } from "@/components/dashboard/DashboardView";
import { getSiteDisplayName } from "@/lib/site-emails";

interface SitePageProps {
  params: Promise<{ slug: string }>;
}

export default async function SitePage({ params }: SitePageProps) {
  const { slug } = await params;
  const name = getSiteDisplayName(slug);

  return (
    <DashboardView
      siteSlug={slug}
      title={name}
      emptyTitle={`No bookings yet for ${name}`}
      emptyDescription="When customers book through this site, they'll appear here instantly."
    />
  );
}
