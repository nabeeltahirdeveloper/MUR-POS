import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiSettings } from "@/types/models";

const GLOBAL_SETTINGS_KEY = "global";

const DEFAULT_SETTINGS: Omit<ApiSettings, "id"> = {
    businessProfile: {
        name: "MUR Traders",
        address: null,
        phone: null,
        email: null,
        logoUrl: "/favicon.jpeg",
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
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const setting = await prisma.systemSetting.findUnique({
            where: { key: GLOBAL_SETTINGS_KEY },
        });

        if (!setting) {
            // Initialize with default settings if not exists
            const defaultWithDate = { ...DEFAULT_SETTINGS, updatedAt: new Date() };
            await prisma.systemSetting.create({
                data: {
                    key: GLOBAL_SETTINGS_KEY,
                    value: JSON.stringify(defaultWithDate),
                },
            });
            return NextResponse.json({ id: GLOBAL_SETTINGS_KEY, ...defaultWithDate });
        }

        const settings = JSON.parse(setting.value);
        return NextResponse.json({ id: GLOBAL_SETTINGS_KEY, ...settings });
    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { businessProfile, currency, inventory, notifications } = body;

        // Read existing settings first for merge
        const existing = await prisma.systemSetting.findUnique({
            where: { key: GLOBAL_SETTINGS_KEY },
        });
        const currentSettings = existing ? JSON.parse(existing.value) : DEFAULT_SETTINGS;

        const updatedSettings = {
            ...currentSettings,
            businessProfile: businessProfile || currentSettings.businessProfile,
            currency: currency || currentSettings.currency,
            inventory: inventory || currentSettings.inventory,
            notifications: notifications || currentSettings.notifications,
            updatedAt: new Date().toISOString(),
        };

        await prisma.systemSetting.upsert({
            where: { key: GLOBAL_SETTINGS_KEY },
            create: {
                key: GLOBAL_SETTINGS_KEY,
                value: JSON.stringify(updatedSettings),
            },
            update: {
                value: JSON.stringify(updatedSettings),
            },
        });

        return NextResponse.json({ message: "Settings updated successfully" });
    } catch (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
