'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * SignupPage Component
 * Provides a user registration interface with validation and error handling.
 * Integrates with the backend signup API and redirects to login on success.
 */
export default function SignupPage() {
    /*
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    /**
     * Handles the form submission
     * Validates passwords and calls the signup API
     * /
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Something went wrong');
            } else {
                router.push('/login?registered=true');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };
    */

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-primary-dark/10 blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-md space-y-8">
                {/* Logo and Header */}
                <div className="text-center">
                    <div className="mx-auto h-24 w-24 rounded-2xl bg-slate-900 p-1 shadow-2xl border border-slate-800 flex items-center justify-center">
                        <img src="/favicon.jpeg" alt="Logo" className="h-full w-full rounded-xl object-cover" />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
                        Registration Disabled
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Self-registration is currently disabled for this system.
                    </p>
                </div>

                <div className="mt-8 rounded-2xl bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl border border-slate-800 text-center">
                    <p className="text-slate-300 mb-6 font-medium">
                        Please contact the administrator to create an account.
                    </p>

                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-dark"
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
