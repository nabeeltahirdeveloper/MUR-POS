'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Load remember me preference from storage on mount
    useEffect(() => {
        const remembered = localStorage.getItem('rememberMe');
        if (remembered === 'true') {
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Store remember me preference
            if (rememberMe) {
                // Persistent: store in localStorage (survives browser close)
                localStorage.setItem('rememberMe', 'true');
                sessionStorage.removeItem('rememberMe');
            } else {
                // Temporary: store in sessionStorage (cleared when browser closes)
                // This flag is used by SessionManager to detect if browser was closed
                sessionStorage.setItem('rememberMe', 'false');
                localStorage.removeItem('rememberMe');
            }

            // Configure sign-in options
            // Ensure callbackUrl uses the current origin so production doesn't redirect to localhost
            const resolvedCallbackUrl = callbackUrl && (callbackUrl.startsWith('http://') || callbackUrl.startsWith('https://'))
                ? callbackUrl
                : `${typeof window !== 'undefined' ? window.location.origin : ''}${callbackUrl}`;

            const signInOptions: any = {
                redirect: false,
                email,
                password,
                callbackUrl: resolvedCallbackUrl,
            };

            if (rememberMe) {
                // Set maxAge to 30 days for persistent cookie
                signInOptions.maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
            } else {
                // Set a short maxAge (1 hour) - SessionManager will handle sign out on browser close
                // Using 1 hour as a safety net, but SessionManager checks sessionStorage to detect browser close
                signInOptions.maxAge = 60 * 60; // 1 hour in seconds
            }

            const result = await signIn('credentials', signInOptions) as any;

            if (result?.error) {
                setError('Invalid email or password');
                // Clear storage on error
                localStorage.removeItem('rememberMe');
                sessionStorage.removeItem('rememberMe');
            } else {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch (err) {
            setError('An unexpected error occurred');
            // Clear storage on error
            localStorage.removeItem('rememberMe');
            sessionStorage.removeItem('rememberMe');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-white/10 blur-[120px]" />
                <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-white/5 blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="mx-auto h-24 w-24 rounded-2xl bg-slate-900 p-1 shadow-2xl border border-slate-800 flex items-center justify-center">
                        <img src="/favicon.jpeg" alt="Logo" className="h-full w-full rounded-xl object-cover" />
                    </div>
                    <h2 className="font-serif mt-6 text-3xl font-extrabold tracking-tight text-white">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Sign in to your MUR Traders account
                    </p>
                </div>

                <div className="mt-8 rounded-2xl bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl border border-slate-800">
                    {error && (
                        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center gap-3">
                            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Password</label>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-primary focus:ring-primary focus:ring-offset-slate-900"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-400">
                                Remember me for 30 days
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? (
                                <svg className="h-5 w-5 animate-spin text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    {/* <div className="mt-8 text-center text-sm">
                        <p className="text-slate-400">
                            Don't have an account?{' '}
                            <Link href="/signup" className="font-semibold text-primary hover:text-primary-dark transition-colors">
                                Create an account
                            </Link>
                        </p>
                    </div> */}
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><LoadingSpinner /></div>}>
            <LoginForm />
        </Suspense>
    );
}
