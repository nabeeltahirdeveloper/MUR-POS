"use client";

import { useState, KeyboardEvent } from "react";
import { XMarkIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useLock } from "@/contexts/LockContext";

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnlockModal({ isOpen, onClose }: UnlockModalProps) {
  const { unlock, isLoading } = useLock();
  const [password, setPassword] = useState("");
  // ✅ default hidden
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!password) {
      setError("Please enter a password");
      return;
    }

    setError("");
    const success = await unlock(password);

    if (success) {
      setPassword("");
      onClose();
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-950 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="relative p-8 text-center border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Unlock Features
          </h3>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">
            Enter password to access protected sections
          </p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl transition-all
                           bg-white text-black
                           dark:bg-gray-900 dark:text-white dark:border-gray-700
                           focus:ring-2 focus:ring-primary focus:border-primary
                           placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Enter password"
                disabled={isLoading}
                autoFocus
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>

            {error && (
              <p className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all font-bold text-sm uppercase tracking-widest"
              disabled={isLoading}
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl text-white bg-primary hover:bg-primary-dark transition-all font-bold text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
