
const units = [
    { name: "Kilogram", symbol: "kg" },
    { name: "Gram", symbol: "g" },
    { name: "Liter", symbol: "l" },
    { name: "Milliliter", symbol: "ml" },
    { name: "Piece", symbol: "pcs" },
    { name: "Dozen", symbol: "dz" },
    { name: "Box", symbol: "box" },
    { name: "Meter", symbol: "m" },
    { name: "Centimeter", symbol: "cm" },
    { name: "Pack", symbol: "pack" }
];

async function seed() {
    console.log("Seeding units...");
    for (const unit of units) {
        try {
            const res = await fetch("http://localhost:3000/api/units", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(unit)
            });
            if (res.ok) {
                console.log(`Created: ${unit.name}`);
            } else if (res.status === 409) {
                console.log(`Exists: ${unit.name}`);
            } else {
                console.error(`Failed: ${unit.name}`, await res.text());
            }
        } catch (e) {
            console.error(`Error creating ${unit.name}`, e);
        }
    }
    console.log("Done.");
}

seed();
