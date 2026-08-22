import { Building2, ChartNoAxesCombined, ClipboardCheck, House, LayoutDashboard, MapPinned, Settings, Sparkles, Users } from "lucide-react";

export type DashboardRole = "owner" | "agency_admin" | "agent" | "building_manager" | "operations" | "analyst" | "resident";

export const dashboardMenuItems: { icon: typeof LayoutDashboard; label: string; path: string; roles: DashboardRole[] }[] = [
  { icon: LayoutDashboard, label: "Overview", path: "/app", roles: ["owner", "agency_admin", "agent", "building_manager", "operations", "analyst", "resident"] },
  { icon: House, label: "Listings", path: "/app/listings", roles: ["owner", "agency_admin", "agent", "operations", "analyst"] },
  { icon: Users, label: "Leads & viewings", path: "/app/leads", roles: ["owner", "agency_admin", "agent", "operations"] },
  { icon: MapPinned, label: "Buyer intelligence", path: "/app/intelligence", roles: ["owner", "agency_admin", "agent", "operations", "analyst"] },
  { icon: Building2, label: "Buildings", path: "/app/buildings", roles: ["owner", "agency_admin", "building_manager", "operations", "resident"] },
  { icon: ClipboardCheck, label: "Operations", path: "/app/operations", roles: ["owner", "agency_admin", "building_manager", "operations"] },
  { icon: Sparkles, label: "GenX studio", path: "/app/studio", roles: ["owner", "agency_admin", "agent", "operations"] },
  { icon: ChartNoAxesCombined, label: "Insights", path: "/app/insights", roles: ["owner", "agency_admin", "analyst", "operations"] },
  { icon: Settings, label: "Settings", path: "/app/settings", roles: ["owner", "agency_admin", "building_manager", "operations"] },
];

export function visibleDashboardNavigation(role: DashboardRole | undefined) {
  return role ? dashboardMenuItems.filter(item => item.roles.includes(role)) : [];
}
