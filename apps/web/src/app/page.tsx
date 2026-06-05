import { CatalogDashboard } from "@/components/catalog-dashboard";
import { fetchDashboard } from "@/lib/api";

export default async function Home() {
  const dashboard = await fetchDashboard();

  return <CatalogDashboard initialData={dashboard} />;
}
