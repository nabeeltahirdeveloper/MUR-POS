import { getAllDocs } from "./src/lib/firestore-helpers";

async function verifyFix() {
    try {
        const ledgerEntries = await getAllDocs('ledger');

        // Group entries by order number
        const orders: Record<number, any[]> = {};
        ledgerEntries.forEach((e: any) => {
            if (e.orderNumber) {
                if (!orders[e.orderNumber]) orders[e.orderNumber] = [];
                orders[e.orderNumber].push(e);
            }
        });

        console.log("Checking Batch Orders for Duplicate Advance Parsing:");
        for (const [orderNum, entries] of Object.entries(orders)) {
            if (entries.length > 1) {
                console.log(`\nOrder #${orderNum} (${entries.length} items):`);
                let totalDedupedCash = 0;
                let processed = false;

                entries.forEach((e: any) => {
                    const lines = (e.note || "").split('\n');
                    let cashMoved = 0;
                    lines.forEach((line: string) => {
                        const trimmed = line.trim();
                        const advMatch = trimmed.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
                        if (advMatch) {
                            cashMoved = Number(advMatch[2]);
                        }
                    });

                    if (!processed) {
                        totalDedupedCash += cashMoved;
                        processed = true;
                    }

                    console.log(` - Entry ID: ${e.id}, Note Cash: ${cashMoved}`);
                });

                console.log(`Calculated Deduped Cash for this Order: ${totalDedupedCash}`);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

verifyFix();
