'use client';

import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Component that manages session based on "Remember Me" preference
 * If user didn't check "Remember Me", sessionStorage will be cleared on browser close
 * This component checks on mount and signs out if sessionStorage flag is missing
 */
export function SessionManager() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Only run when session is loaded
        if (status !== 'authenticated') return;

        // Check if "remember me" was checked (stored in localStorage - persistent)
        const remembered = localStorage.getItem('rememberMe') === 'true';
        
        // Check if sessionStorage has the temporary login flag (cleared on browser close)
        const hasSessionFlag = sessionStorage.getItem('rememberMe') === 'false';

        // Logic:
        // - If remembered (localStorage): Keep session (persistent cookie)
        // - If not remembered AND sessionStorage has flag: Keep session (browser wasn't closed, just refreshed)
        // - If not remembered AND no sessionStorage flag: Sign out (browser was closed, sessionStorage cleared)
        if (!remembered && !hasSessionFlag) {
            // Browser was closed, sessionStorage was cleared, but user is still logged in
            // Sign out to enforce "remember me" behavior
            signOut({ redirect: false }).then(() => {
                // Clear any remaining storage
                localStorage.removeItem('rememberMe');
                sessionStorage.removeItem('rememberMe');
                
                // Only redirect if not already on login/signup page
                if (!pathname?.startsWith('/login') && !pathname?.startsWith('/signup')) {
                    router.push('/login');
                    router.refresh();
                }
            });
        }
    }, [status, session, pathname, router]);

    return null; // This component doesn't render anything
}

