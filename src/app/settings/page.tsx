"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { FirestoreSettings } from "@/types/firestore";
import {
    BuildingOfficeIcon,
    BanknotesIcon,
    BellIcon,
    CubeIcon,
    CheckCircleIcon
} from "@heroicons/react/24/outline";

type Tab = "profile" | "currency" | "inventory" | "notifications";

export default function SettingsPage() {
    const [settings, setSettings] = useState<FirestoreSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("profile");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        try {
            setSaving(true);
            setMessage(null);
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "Settings saved successfully!" });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: "error", text: "Failed to save settings." });
            }
        } catch (error) {
            setMessage({ type: "error", text: "An error occurred while saving." });
        } finally {
            setSaving(false);
        }
    };

    const updateProfile = (field: string, value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            businessProfile: { ...settings.businessProfile, [field]: value },
        });
    };

    const updateCurrency = (field: string, value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            currency: { ...settings.currency, [field]: value },
        });
    };

    const updateInventory = (field: string, value: any) => {
        if (!settings) return;
        setSettings({
            ...settings,
            inventory: { ...settings.inventory, [field]: value },
        });
    };

    const toggleNotification = (type: string) => {
        if (!settings) return;
        const current = settings.notifications.alertTypes;
        const next = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
        setSettings({
            ...settings,
            notifications: { ...settings.notifications, alertTypes: next },
        });
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <LoadingSpinner />
                </div>
            </DashboardLayout>
        );
    }

    const tabs = [
        { id: "profile", name: "Business Profile", icon: BuildingOfficeIcon },
        { id: "currency", name: "Currency & Region", icon: BanknotesIcon },
        { id: "inventory", name: "Inventory Alerts", icon: CubeIcon },
        { id: "notifications", name: "Notifications", icon: BellIcon },
    ];

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Configure your business profile and application preferences.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar Tabs */}
                    <div className="w-full md:w-64 space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === tab.id
                                        ? "bg-primary/10 text-primary border-r-4 border-primary"
                                        : "bg-white text-gray-600 hover:bg-gray-50"
                                    }`}
                            >
                                <tab.icon className="h-5 w-5" />
                                {tab.name}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            {activeTab === "profile" && settings && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Business Information</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Business Name</label>
                                            <input
                                                type="text"
                                                value={settings.businessProfile.name}
                                                onChange={(e) => updateProfile("name", e.target.value)}
                                                className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                placeholder="e.g. Moon Traders"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Tagline</label>
                                            <input
                                                type="text"
                                                value={settings.businessProfile.tagline || ""}
                                                onChange={(e) => updateProfile("tagline", e.target.value)}
                                                className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                placeholder="e.g. Quality Electric Solutions"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                                <input
                                                    type="text"
                                                    value={settings.businessProfile.phone || ""}
                                                    onChange={(e) => updateProfile("phone", e.target.value)}
                                                    className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                                <input
                                                    type="email"
                                                    value={settings.businessProfile.email || ""}
                                                    onChange={(e) => updateProfile("email", e.target.value)}
                                                    className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Address</label>
                                            <textarea
                                                rows={3}
                                                value={settings.businessProfile.address || ""}
                                                onChange={(e) => updateProfile("address", e.target.value)}
                                                className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "currency" && settings && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Currency Settings</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Currency Symbol</label>
                                                <input
                                                    type="text"
                                                    value={settings.currency.symbol}
                                                    onChange={(e) => updateCurrency("symbol", e.target.value)}
                                                    className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">ISO Code</label>
                                                <input
                                                    type="text"
                                                    value={settings.currency.code}
                                                    onChange={(e) => updateCurrency("code", e.target.value)}
                                                    className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Symbol Position</label>
                                            <select
                                                value={settings.currency.position}
                                                onChange={(e) => updateCurrency("position", e.target.value)}
                                                className="mt-1 block w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            >
                                                <option value="prefix">Prefix (e.g. $100)</option>
                                                <option value="suffix">Suffix (e.g. 100 Rs.)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "inventory" && settings && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Inventory Thresholds</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">Enable Low Stock Alerts</p>
                                                <p className="text-xs text-gray-500">Show warnings when stock falls below threshold.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.inventory.enableLowStockAlerts}
                                                    onChange={(e) => updateInventory("enableLowStockAlerts", e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                            </label>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Global Minimum Stock Level</label>
                                            <input
                                                type="number"
                                                value={settings.inventory.globalMinStockLevel}
                                                onChange={(e) => updateInventory("globalMinStockLevel", parseInt(e.target.value))}
                                                className="mt-1 block w-32 rounded-lg border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Used as fallback if item-specific threshold is not set.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "notifications" && settings && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Notification Preferences</h3>
                                    <div className="space-y-3">
                                        {["low_stock", "bill_due", "debt_due"].map((type) => (
                                            <div key={type} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                                <span className="text-sm font-medium text-gray-700 capitalize">
                                                    {type.replace("_", " ")} Alerts
                                                </span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.notifications.alertTypes.includes(type)}
                                                        onChange={() => toggleNotification(type)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-6 border-t mt-6">
                                {message && (
                                    <div className={`flex items-center gap-2 text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                                        {message.type === "success" && <CheckCircleIcon className="h-4 w-4" />}
                                        {message.text}
                                    </div>
                                )}
                                <div className="ml-auto">
                                    <Button type="submit" disabled={saving}>
                                        {saving ? "Saving..." : "Save Settings"}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
