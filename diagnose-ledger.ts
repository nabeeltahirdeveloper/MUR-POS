import { getAllDocs } from "./src/lib/firestore-helpers";

async function diagnose() {
    try {
        const ledgerEntries = await getAllDocs('ledger');
        // Sort by date descending
        const recent = ledgerEntries
            .sort((a: any, b: any) => {
                const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return db.getTime() - da.getTime();
            })
            .slice(0, 5);

        console.log("Recent Ledger Entries:");
        recent.forEach((e: any) => {
            console.log("---");
            console.log("ID:", e.id);
            console.log("Type:", e.type);
            console.log("Amount:", e.amount);
            console.log("Date:", e.date?.toDate ? e.date.toDate().toISOString() : e.date);
            console.log("Note:", e.note);
        });
    } catch (err) {
        console.error(err);
    }
}

diagnose();
