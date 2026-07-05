import { DashboardView } from "@/components/dashboard/DashboardView";

const SITE_NAMES: Record<string, string> = {
  sanford: "Sanford Cleaning",
  deltona: "Deltona Cleaning",
  "haines-city": "Haines City Cleaning",
  celebration: "Celebration Cleaning",
  "winter-haven": "Cleaning Winter Haven",
};

interface SitePageProps {
  params: Promise<{ slug: string }>;
}

export default async function SitePage({ params }: SitePageProps) {
  const { slug } = await params;
  const name = SITE_NAMES[slug] ?? slug;

  return (
    <DashboardView
      siteSlug={slug}
      title={name}
      emptyTitle={`No bookings yet for ${name}`}
      emptyDescription="When customers book through this site, they'll appear here instantly."
    />
  );
}
