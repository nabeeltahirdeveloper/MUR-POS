'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DashboardLayout } from "@/components/layout";

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const router = useRouter();

    const [name, setName] = useState(session?.user?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const [profileMessage, setProfileMessage] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);

    if (!session) {
        return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingProfile(true);
        setProfileMessage('');

        try {
            const res = await fetch('/api/user/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            const data = await res.json();

            if (res.ok) {
                setProfileMessage('Profile updated successfully');
                await update({ name }); // Update session
            } else {
                setProfileMessage(data.message || 'Error updating profile');
            }
        } catch (error) {
            setProfileMessage('An error occurred');
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingPassword(true);
        setPasswordMessage('');

        if (newPassword !== confirmNewPassword) {
            setPasswordMessage('New passwords do not match');
            setLoadingPassword(false);
            return;
        }

        try {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                setPasswordMessage('Password changed successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
            } else {
                setPasswordMessage(data.message || 'Error changing password');
            }
        } catch (error) {
            setPasswordMessage('An error occurred');
        } finally {
            setLoadingPassword(false);
        }
    };

    return (
        <DashboardLayout>
        <div className="mx-auto max-w-4xl p-6">
            <h1 className="mb-8 text-3xl font-bold">User Profile</h1>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Profile Info & Update */}
                <div className="rounded-lg bg-white p-6 shadow-md">
                    <h2 className="mb-4 text-xl font-semibold">Profile Information</h2>
                    <div className="mb-4">
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{session.user?.email}</p>
                    </div>
                    <div className="mb-4">
                        <p className="text-sm text-gray-500">Role</p>
                        <p className="font-medium capitalize">{session.user?.role}</p>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                            />
                        </div>

                        {profileMessage && (
                            <p className={`text-sm ${profileMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                                {profileMessage}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loadingProfile}
                            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                            {loadingProfile ? 'Updating...' : 'Update Profile'}
                        </button>
                    </form>
                </div>

                {/* Change Password */}
                <div className="rounded-lg bg-white p-6 shadow-md">
                    <h2 className="mb-4 text-xl font-semibold">Change Password</h2>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                                required
                            />
                        </div>

                        {passwordMessage && (
                            <p className={`text-sm ${passwordMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                                {passwordMessage}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loadingPassword}
                            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                            {loadingPassword ? 'Changing...' : 'Change Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
        </DashboardLayout>
    );
}
