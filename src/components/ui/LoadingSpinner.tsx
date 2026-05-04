import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
}

export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
    const sizeStyles = {
        sm: 'h-6 w-6 rounded-md',
        md: 'h-12 w-12 rounded-xl',
        lg: 'h-16 w-16 rounded-2xl',
    };

    return (
        <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
                {/* Pulse ring */}
                <span
                    aria-hidden="true"
                    className={`absolute inset-0 ${sizeStyles[size]} ring-2 ring-primary/40 animate-ping`}
                />
                {/* Brand mark */}
                <img
                    src="/favicon.jpeg"
                    alt="Loading"
                    className={`relative ${sizeStyles[size]} object-cover shadow-[0_0_24px_rgba(255,255,255,0.35)] animate-pulse`}
                />
            </div>
            {message && (
                <p className="mt-3 text-sm text-gray-600">{message}</p>
            )}
        </div>
    );
}
