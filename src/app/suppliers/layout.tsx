import { DashboardLayout } from "@/components/layout";

export default function SuppliersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}


