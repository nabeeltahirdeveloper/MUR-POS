import Link from "next/link";
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

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Logo" className="h-9 w-9 rounded-lg object-cover" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Moon Traders
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-primary to-primary-dark text-slate-900 rounded-full hover:from-primary/90 hover:to-primary-dark/90 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-dark/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="relative max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-300">Business Management Simplified</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="text-white">Professional</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-primary-dark bg-clip-text text-transparent">
              General Order Supplier
            </span>
            <br />
            <span className="text-white">Solutions</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 text-balance">
            Your Trust, Our Promise. All-in-one management for inventory, ledger,
            and orders, tailored for efficient supplier operations.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary-dark text-slate-900 rounded-full hover:from-primary/90 hover:to-primary-dark/90 transition-all shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105"
            >
              Start Free Today
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-lg font-medium text-slate-300 border border-slate-600 rounded-full hover:bg-slate-800/50 hover:border-slate-500 transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-16 pt-16 border-t border-slate-800/50">
            {[
              { value: "6+", label: "Core Features" },
              { value: "100%", label: "Cloud-Based" },
              { value: "24/7", label: "Access Anywhere" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
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
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to
              <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent"> Succeed</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Powerful features designed specifically for electrical supply businesses to streamline operations and boost productivity.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-6 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/50 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 text-primary group-hover:scale-110 transition-transform duration-300">
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
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Get Started in
              <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent"> 3 Simple Steps</span>
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
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}

                <div className="relative text-center p-6">
                  {/* Step number */}
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-dark text-slate-900 text-xl font-bold mb-6 shadow-lg shadow-primary/30">
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
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Transform Your Business?
              </h2>
              <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                Join businesses that trust Moon Traders to manage their operations efficiently.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary-dark text-slate-900 rounded-full hover:from-primary/90 hover:to-primary-dark/90 transition-all shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105"
              >
                Get Started Free
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <img src="/favicon.jpg" alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                Moon Traders
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8">
              <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="text-sm text-slate-400 hover:text-white transition-colors">
                Sign Up
              </Link>
            </div>

            {/* Copyright */}
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Moon Traders. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
