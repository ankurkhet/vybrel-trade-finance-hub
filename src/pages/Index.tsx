import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  Brain,
  Shield,
  BarChart3,
  Zap,
  Globe,
  ChevronRight,
  Lock,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Invoice & Contract Management",
    desc: "Upload, track, and manage invoices and contracts in one unified workspace with full audit trails.",
  },
  {
    icon: Brain,
    title: "AI-Powered Credit Analysis",
    desc: "Generate credit memos, risk scores, and borrower assessments automatically with built-in AI.",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    desc: "Multi-factor authentication, role-based access, and end-to-end encryption to protect every transaction.",
  },
  {
    icon: BarChart3,
    title: "Portfolio Analytics",
    desc: "Real-time dashboards and exportable reports across your entire portfolio of borrowers and transactions.",
  },
  {
    icon: Layers,
    title: "Multi-Tenant Architecture",
    desc: "Each originator gets an isolated, brandable workspace with full control over borrowers and funders.",
  },
  {
    icon: Globe,
    title: "Cross-Border Ready",
    desc: "Multi-currency support and compliance workflows designed for international trade finance.",
  },
];

const steps = [
  {
    num: "01",
    title: "Register as an Originator",
    desc: "Sign up, choose a subscription plan, and configure your branded workspace in minutes.",
  },
  {
    num: "02",
    title: "Onboard Your Borrowers",
    desc: "Invite borrowers, collect KYC documents, and set credit limits—all within the platform.",
  },
  {
    num: "03",
    title: "Submit & Finance Invoices",
    desc: "Borrowers submit invoices, AI verifies them against contracts, and funders provide liquidity.",
  },
  {
    num: "04",
    title: "Monitor & Report",
    desc: "Track performance, generate compliance reports, and scale your operations with confidence.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<2min", label: "AI Credit Memo" },
  { value: "256-bit", label: "Encryption" },
  { value: "24/7", label: "Platform Access" },
];

export default function Index() {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'Space Grotesk', 'DM Sans', sans-serif" }}>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] overflow-hidden">
        {/* Gradient orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,hsl(174,62%,42%,0.08),transparent_70%)]" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Vybrel</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-[hsl(var(--surface-dark-foreground))]/50 transition-colors hover:text-primary">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-[hsl(var(--surface-dark-foreground))]/50 transition-colors hover:text-primary">
              How It Works
            </a>
            <a href="#pricing" className="text-sm text-[hsl(var(--surface-dark-foreground))]/50 transition-colors hover:text-primary">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-[hsl(var(--surface-dark-foreground))]/70 hover:text-primary hover:bg-transparent">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                Get Started
              </Button>
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-32 lg:px-8 lg:pt-36">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-8">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Secure Trade Finance Platform</span>
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Streamline your{" "}
            <span className="text-primary">trade finance</span>{" "}
            operations
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[hsl(var(--surface-dark-foreground))]/50">
            Vybrel connects originators, borrowers, and funders on a single
            platform—with AI-driven insights, automated workflows, and
            enterprise-grade security.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold min-w-[200px]">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" className="border border-[hsl(var(--surface-dark-tertiary))] bg-transparent text-[hsl(var(--surface-dark-foreground))] hover:border-primary/40 hover:bg-[hsl(var(--surface-dark-secondary))] min-w-[200px]">
                Sign In to Portal
              </Button>
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mt-20 grid grid-cols-2 gap-px rounded-xl border border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark-tertiary))] sm:grid-cols-4 overflow-hidden">
            {stats.map((s) => (
              <div key={s.label} className="bg-[hsl(var(--surface-dark))] px-6 py-5 text-center">
                <p className="text-2xl font-bold text-primary">{s.value}</p>
                <p className="mt-1 text-xs text-[hsl(var(--surface-dark-foreground))]/40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Capabilities
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to manage trade finance
            </h2>
            <p className="mt-4 text-[hsl(var(--surface-dark-foreground))]/50 leading-relaxed">
              From origination to settlement, Vybrel automates the complex and lets you focus on growth.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] p-6 transition-all hover:border-primary/30 hover:bg-[hsl(var(--surface-dark))]/80"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--surface-dark-foreground))]/45">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Get started in four simple steps
            </h2>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                <span className="text-5xl font-bold text-primary/10">{s.num}</span>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--surface-dark-foreground))]/45">
                  {s.desc}
                </p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-8 -right-4 h-5 w-5 text-primary/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section id="pricing" className="bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))] py-24">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to transform your trade finance operations?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[hsl(var(--surface-dark-foreground))]/50">
            Register as an originator today and choose a plan that scales with your business.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                View Plans & Pricing <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] py-10 text-[hsl(var(--surface-dark-foreground))]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold tracking-tight">Vybrel</span>
          </div>
          <div className="flex gap-6 text-sm text-[hsl(var(--surface-dark-foreground))]/40">
            <Link to="/privacy" className="hover:text-primary">Privacy</Link>
            <Link to="/terms" className="hover:text-primary">Terms</Link>
            <Link to="/dpa" className="hover:text-primary">DPA</Link>
          </div>
          <p className="text-xs text-[hsl(var(--surface-dark-foreground))]/30">
            © {new Date().getFullYear()} Vybrel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
