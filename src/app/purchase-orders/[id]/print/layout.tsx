export const metadata = {
    title: "Print Purchase Order",
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head />
            <body style={{ margin: 0 }}>
                {children}
            </body>
        </html>
    );
}
