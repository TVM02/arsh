import DashboardAuthGate from "@/components/DashboardAuthGate";

export default function DashboardLayout({ children }) {
  return <DashboardAuthGate>{children}</DashboardAuthGate>;
}
