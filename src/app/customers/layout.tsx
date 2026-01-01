import { DashboardLayout } from "@/components/layout";

export default function CustomersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
