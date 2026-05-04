import Link from "next/link";
import { auth } from "@/auth";
import {
  CubeIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  BoltIcon,
  BanknotesIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";

// Feature data with heroicon components
const features = [
  {
    Icon: CubeIcon,
    title: "Inventory Management",
    description: "Track items, categories, units, and stock levels with smart low-stock alerts.",
  },
  {
    Icon: ChartBarIcon,
    title: "Ledger & Accounting",
    description: "Monitor your income and expenses with categorized transaction tracking.",
  },
  {
    Icon: ShoppingCartIcon,
    title: "Purchase Orders",
    description: "Manage suppliers and streamline your ordering process efficiently.",
  },
  {
    Icon: BoltIcon,
    title: "Utilities Tracking",
    description: "Never miss a bill payment with utility tracking and due date management.",
  },
  {
    Icon: BanknotesIcon,
    title: "Debt Management",
    description: "Keep track of loans given and received with payment history.",
  },
  {
    Icon: BellAlertIcon,
    title: "Smart Reminders",
    description: "Automated alerts for low stock, utilities bills, and debt payments.",
  },
];

// How it works steps
const steps = [
  {
    number: "01",
    title: "Sign Up",
    description: "Create your account in seconds and set up your business profile.",
  },
  {
    number: "02",
    title: "Add Your Data",
    description: "Import your inventory, suppliers, and financial records easily.",
  },
  {
    number: "03",
    title: "Manage & Grow",
    description: "Use insights and automation to run your business smarter.",
  },
];

export default async function Home() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-xl ring-1 ring-white/15 shadow-[0_0_20px_rgba(255,255,255,0.5),0_0_6px_rgba(255,255,255,0.35)]">
              <img src="/favicon.jpeg" alt="Logo" className="h-11 w-11 rounded-xl object-cover block" />
            </div>
            <span className="font-serif text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              MUR Traders
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {session ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
            )}
            {/* <Link
              href="/signup"
              className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-primary to-primary-dark text-slate-900 rounded-full hover:from-primary/90 hover:to-primary-dark/90 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
            >
              Get Started
            </Link> */}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="relative max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-300">Business Management Simplified</span>
          </div>

          {/* Logo lockup */}
          <div className="flex justify-center mb-8">
            <div className="rounded-2xl ring-1 ring-white/15 shadow-[0_0_80px_rgba(255,255,255,0.55),0_0_20px_rgba(255,255,255,0.4)]">
              <img src="/favicon.jpeg" alt="MUR Traders" className="h-24 w-24 rounded-2xl object-cover block" />
            </div>
          </div>

          {/* Main heading */}
          <h1 className="font-serif text-5xl md:text-7xl font-bold leading-tight mb-6 text-white">
            MUR Traders
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 text-balance">
            Power your business with the future of trading technology.
            Reliable. Modern. Simplified.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* <Link
              href="/signup"
              className="group px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary-dark text-slate-900 rounded-full hover:from-primary/90 hover:to-primary-dark/90 transition-all shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105"
            >
              Start Free Today
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link> */}
            {session ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 text-lg font-medium text-slate-300 border border-slate-600 rounded-full hover:bg-slate-800/50 hover:border-slate-500 transition-all"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-8 py-4 text-lg font-medium text-slate-300 border border-slate-600 rounded-full hover:bg-slate-800/50 hover:border-slate-500 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-16 pt-16 border-t border-slate-800/50">
            {[
              { value: "6+", label: "Core Features" },
              { value: "100%", label: "Cloud-Based" },
              { value: "24/7", label: "Access Anywhere" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent"> Succeed</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Powerful features designed to streamline operations and boost productivity.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-6 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/50 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 text-white group-hover:scale-110 transition-transform duration-300">
                  <feature.Icon className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">
              Get Started in
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent"> 3 Simple Steps</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From signup to full business management in minutes, not days.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-white/40 to-transparent" />
                )}

                <div className="relative text-center p-6">
                  {/* Step number */}
                  <div className="font-serif inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-white to-slate-300 text-slate-900 text-xl font-bold mb-6 shadow-lg shadow-white/10">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-12 rounded-3xl bg-gradient-to-r from-primary/10 to-primary-dark/10 border border-primary/20 text-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary-dark/5 blur-3xl" />

            <div className="relative">
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Transform Your Business?
              </h2>
              <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                Join businesses that trust MUR Traders to manage their operations efficiently.
              </p>
              {/* <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary-dark text-slate-900 rounded-full hover:from-primary/90 hover:to-primary-dark/90 transition-all shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105"
              >
                Get Started Free
                <span>→</span>
              </Link> */}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 px-6 border-t border-white/10">
        {/* Subtle gold accent line at top of footer */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg ring-1 ring-white/15 shadow-[0_0_18px_rgba(255,255,255,0.45)]">
                <img src="/favicon.jpeg" alt="Logo" className="h-10 w-10 rounded-lg object-cover block" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent leading-none">
                  MUR Traders
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">
                  Power your business
                </span>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8">
              {session ? (
                <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
              ) : (
                <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  Sign In
                </Link>
              )}
            </div>

            {/* Copyright */}
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} MUR Traders. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
