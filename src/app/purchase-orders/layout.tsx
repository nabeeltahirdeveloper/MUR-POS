import { DashboardLayout } from "@/components/layout";

export default function PurchaseOrdersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}


