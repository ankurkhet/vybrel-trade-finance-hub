import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  Brain,
  Shield,
  BarChart3,
  ChevronRight,
  Lock,
  Layers,
  Globe,
  Hexagon,
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
    <div className="min-h-screen" style={{ fontFamily: "'Source Serif 4', 'Outfit', serif" }}>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] overflow-hidden">
        {/* Warm glow */}
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[radial-gradient(ellipse_at_top_right,hsl(25,70%,48%,0.06),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_bottom_left,hsl(25,70%,48%,0.04),transparent_70%)]" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Hexagon className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Vybrel</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-[hsl(var(--surface-dark-foreground))]/45 transition-colors hover:text-primary">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-[hsl(var(--surface-dark-foreground))]/45 transition-colors hover:text-primary">
              How It Works
            </a>
            <a href="#pricing" className="text-sm text-[hsl(var(--surface-dark-foreground))]/45 transition-colors hover:text-primary">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-[hsl(var(--surface-dark-foreground))]/60 hover:text-primary hover:bg-transparent">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/85 font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-28 pb-36 lg:px-8 lg:pt-40">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 mb-8">
            <Lock className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">Secure Trade Finance Platform</span>
          </div>
          <h1 className="max-w-3xl text-5xl font-light leading-[1.1] tracking-tight sm:text-6xl lg:text-[4.5rem]">
            Modern infrastructure for{" "}
            <span className="text-primary font-normal">trade finance</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-[hsl(var(--surface-dark-foreground))]/45" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Vybrel connects originators, borrowers, and funders on a single
            platform—with AI-driven insights, automated workflows, and
            enterprise-grade security.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/85 font-medium min-w-[200px]">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" className="border border-[hsl(var(--surface-dark-tertiary))] bg-transparent text-[hsl(var(--surface-dark-foreground))]/70 hover:border-primary/30 hover:bg-[hsl(var(--surface-dark-secondary))] min-w-[200px]">
                Sign In to Portal
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-24 grid grid-cols-2 gap-px rounded-xl overflow-hidden border border-[hsl(var(--surface-dark-tertiary))]/50 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-[hsl(var(--surface-dark-secondary))]/60 px-6 py-6 text-center backdrop-blur-sm">
                <p className="text-2xl font-light text-primary tracking-tight">{s.value}</p>
                <p className="mt-1.5 text-[11px] uppercase tracking-widest text-[hsl(var(--surface-dark-foreground))]/30" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))] py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Capabilities
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
              Everything you need to manage trade finance
            </h2>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-[hsl(var(--surface-dark-tertiary))]/60 bg-[hsl(var(--surface-dark))]/50 p-7 transition-all duration-300 hover:border-primary/20 hover:bg-[hsl(var(--surface-dark))]/80"
              >
                <f.icon className="h-5 w-5 text-primary/70" strokeWidth={1.5} />
                <h3 className="mt-5 text-[15px] font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>{f.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[hsl(var(--surface-dark-foreground))]/40" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary" style={{ fontFamily: "'Outfit', sans-serif" }}>
              How It Works
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
              Four steps to get started
            </h2>
          </div>

          <div className="mt-20 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                <span className="text-6xl font-extralight text-primary/8">{s.num}</span>
                <h3 className="mt-1 text-[15px] font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[hsl(var(--surface-dark-foreground))]/40" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {s.desc}
                </p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-10 -right-5 h-4 w-4 text-primary/15" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section id="pricing" className="bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))] py-28">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
            Ready to transform your operations?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm text-[hsl(var(--surface-dark-foreground))]/40" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Register as an originator today and choose a plan that scales with your business.
          </p>
          <div className="mt-10">
            <Link to="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/85 font-medium">
                View Plans & Pricing <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[hsl(var(--surface-dark-tertiary))]/50 bg-[hsl(var(--surface-dark))] py-10 text-[hsl(var(--surface-dark-foreground))]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Vybrel</span>
          </div>
          <div className="flex gap-6 text-sm text-[hsl(var(--surface-dark-foreground))]/30" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/dpa" className="hover:text-primary transition-colors">DPA</Link>
          </div>
          <p className="text-xs text-[hsl(var(--surface-dark-foreground))]/25" style={{ fontFamily: "'Outfit', sans-serif" }}>
            © {new Date().getFullYear()} Vybrel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
