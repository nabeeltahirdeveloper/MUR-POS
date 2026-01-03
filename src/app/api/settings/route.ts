import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/firestore";
import { getDocById } from "@/lib/firestore-helpers";
import { FirestoreSettings } from "@/types/firestore";

const SETTINGS_COLLECTION = "settings";
const GLOBAL_SETTINGS_ID = "global";

const DEFAULT_SETTINGS: Omit<FirestoreSettings, "id"> = {
    businessProfile: {
        name: "Moon Traders",
        address: null,
        phone: null,
        email: null,
        logoUrl: "/favicon.jpg",
        tagline: null,
    },
    currency: {
        symbol: "Rs.",
        code: "PKR",
        position: "prefix",
    },
    inventory: {
        globalMinStockLevel: 5,
        enableLowStockAlerts: true,
    },
    notifications: {
        emailEnabled: false,
        alertTypes: ["low_stock", "bill_due", "debt_due"],
    },
    updatedAt: new Date(),
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        console.log("[API] GET /api/settings called");
        const session = await auth();
        console.log("[API] GET /api/settings - Session:", session ? "Found" : "None");
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let settings = await getDocById<FirestoreSettings>(SETTINGS_COLLECTION, GLOBAL_SETTINGS_ID);

        if (!settings) {
            // Initialize with default settings if not exists
            await db.collection(SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_ID).set({
                ...DEFAULT_SETTINGS,
                updatedAt: new Date(),
            });
            settings = { id: GLOBAL_SETTINGS_ID, ...DEFAULT_SETTINGS } as FirestoreSettings;
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        console.log("[API] POST /api/settings called");
        const session = await auth();

        console.log("[API] POST /api/settings - Session User:", session?.user ? { id: session.user.id, role: session.user.role } : "No User");

        if (!session || !session.user) {
            console.log("[API] POST /api/settings - 401 Unauthorized (No Session)");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Allow admin or staff to update settings for now
        // if (session.user.role !== "admin") { ... } 

        const body = await req.json();
        const { businessProfile, currency, inventory, notifications } = body;

        const updatedSettings = {
            businessProfile: businessProfile || DEFAULT_SETTINGS.businessProfile,
            currency: currency || DEFAULT_SETTINGS.currency,
            inventory: inventory || DEFAULT_SETTINGS.inventory,
            notifications: notifications || DEFAULT_SETTINGS.notifications,
            updatedAt: new Date(),
        };

        await db.collection(SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_ID).set(updatedSettings, { merge: true });

        return NextResponse.json({ message: "Settings updated successfully" });
    } catch (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
