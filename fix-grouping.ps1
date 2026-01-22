$filePath = "d:\Usman Projects\Projects\Moon-Traders\src\components\ledger\SupplierTransactionDropdown.tsx"
$content = Get-Content $filePath -Raw

$oldFunction = @"
    const groupByDate = (entries: LedgerEntry[]): DateGroup[] => {
        const groups: Record<string, LedgerEntry[]> = {};
        
        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(entry);
        });

        return Object.entries(groups).map(([date, entries]) => ({
            date,
            entries: entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            itemCount: entries.length,
            total: entries.reduce((sum, e) => sum + e.amount, 0)
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
"@

$newFunction = @"
    const groupByDate = (entries: LedgerEntry[]): DateGroup[] => {
        const dateGroups: Record<string, Record<string, LedgerEntry[]>> = {};
        
        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            const groupKey = entry.orderNumber ? ``order-$${entry.orderNumber}`` : ``entry-$${entry.id}``;
            
            if (!dateGroups[date]) {
                dateGroups[date] = {};
            }
            if (!dateGroups[date][groupKey]) {
                dateGroups[date][groupKey] = [];
            }
            dateGroups[date][groupKey].push(entry);
        });

        const result: DateGroup[] = [];
        Object.entries(dateGroups).forEach(([date, groups]) => {
            Object.entries(groups).forEach(([groupKey, groupEntries]) => {
                result.push({
                    date,
                    entries: groupEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                    itemCount: groupEntries.length,
                    total: groupEntries.reduce((sum, e) => sum + e.amount, 0),
                    orderNumber: groupEntries[0].orderNumber
                });
            });
        });

        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
"@

$content = $content -replace [regex]::Escape($oldFunction), $newFunction
Set-Content $filePath $content -NoNewline

Write-Host "File updated successfully!"
