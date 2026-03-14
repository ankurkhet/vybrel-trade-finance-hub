import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Check,
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

interface Plan {
  id: string;
  name: string;
  price_gbp: number;
  max_borrowers: number;
  max_funders: number;
  max_monthly_volume_gbp: number;
  features: string[];
  is_popular: boolean;
}

export default function Index() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setPlans(data as unknown as Plan[]);
      });
  }, []);

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] overflow-hidden">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[radial-gradient(ellipse_at_top_right,hsl(25,65%,48%,0.08),transparent_70%)]" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Hexagon className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <span className="text-xl font-semibold tracking-tight">Vybrel</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm opacity-60 transition-opacity hover:opacity-100 hover:text-primary">
              Features
            </a>
            <a href="#how-it-works" className="text-sm opacity-60 transition-opacity hover:opacity-100 hover:text-primary">
              How It Works
            </a>
            <a href="#pricing" className="text-sm opacity-60 transition-opacity hover:opacity-100 hover:text-primary">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="opacity-70 hover:opacity-100 hover:text-primary hover:bg-transparent">
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
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 mb-8">
            <Lock className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">Secure Trade Finance Platform</span>
          </div>
          <h1 className="max-w-3xl text-5xl font-light leading-[1.1] tracking-tight sm:text-6xl lg:text-[4.5rem]" style={{ fontFamily: "'Source Serif 4', serif" }}>
            Modern infrastructure for{" "}
            <span className="text-primary font-normal">trade finance</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed opacity-60">
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
              <Button size="lg" variant="outline" className="border-[hsl(var(--surface-dark-tertiary))] bg-transparent text-[hsl(var(--surface-dark-foreground))] hover:border-primary/30 hover:bg-[hsl(var(--surface-dark-secondary))] min-w-[200px]">
                Sign In to Portal
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-24 grid grid-cols-2 gap-px rounded-xl overflow-hidden border border-[hsl(var(--surface-dark-tertiary))] sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-[hsl(var(--surface-dark-secondary))] px-6 py-6 text-center">
                <p className="text-2xl font-light text-primary tracking-tight">{s.value}</p>
                <p className="mt-1.5 text-[11px] uppercase tracking-widest opacity-40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))] py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary">
              Capabilities
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Everything you need to manage trade finance
            </h2>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] p-7 transition-all duration-300 hover:border-primary/25"
              >
                <f.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <h3 className="mt-5 text-[15px] font-medium">{f.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed opacity-55">
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
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary">
              How It Works
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Four steps to get started
            </h2>
          </div>

          <div className="mt-20 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                <span className="text-6xl font-extralight text-primary/10">{s.num}</span>
                <h3 className="mt-1 text-[15px] font-medium">{s.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed opacity-55">
                  {s.desc}
                </p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-10 -right-5 h-4 w-4 text-primary/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))] py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary">
              Pricing
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Plans that scale with your business
            </h2>
            <p className="mt-4 text-sm opacity-55">
              All plans include core platform features. Choose based on your portfolio size.
            </p>
          </div>

          {plans.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-8 transition-all ${
                    plan.is_popular
                      ? "border-primary/40 bg-[hsl(var(--surface-dark))]"
                      : "border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))]"
                  }`}
                >
                  {plan.is_popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-medium">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-light text-primary">
                      £{plan.price_gbp.toLocaleString()}
                    </span>
                    <span className="text-sm opacity-50">/month</span>
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm">
                    <p className="font-medium">
                      {plan.max_borrowers === -1 ? "Unlimited" : `Up to ${plan.max_borrowers}`} borrowers
                    </p>
                    <p className="opacity-55">
                      {plan.max_funders === -1 ? "Unlimited" : `Up to ${plan.max_funders}`} funders
                    </p>
                    <p className="opacity-55">
                      {plan.max_monthly_volume_gbp === -1
                        ? "Unlimited"
                        : `£${(plan.max_monthly_volume_gbp / 1000).toLocaleString()}K`}{" "}
                      monthly volume
                    </p>
                  </div>

                  <div className="my-6 h-px bg-[hsl(var(--surface-dark-tertiary))]" />

                  <ul className="flex-1 space-y-3">
                    {(plan.features as string[]).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm opacity-75">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link to="/signup" className="mt-8">
                    <Button
                      className={`w-full font-medium ${
                        plan.is_popular
                          ? "bg-primary text-primary-foreground hover:bg-primary/85"
                          : "border border-[hsl(var(--surface-dark-tertiary))] bg-transparent hover:bg-[hsl(var(--surface-dark-secondary))]"
                      }`}
                    >
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 opacity-50">
              <p>Loading plans...</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] py-10 text-[hsl(var(--surface-dark-foreground))]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight">Vybrel</span>
          </div>
          <div className="flex gap-6 text-sm opacity-40">
            <Link to="/privacy" className="hover:text-primary hover:opacity-100 transition-all">Privacy</Link>
            <Link to="/terms" className="hover:text-primary hover:opacity-100 transition-all">Terms</Link>
            <Link to="/dpa" className="hover:text-primary hover:opacity-100 transition-all">DPA</Link>
          </div>
          <p className="text-xs opacity-30">
            © {new Date().getFullYear()} Vybrel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
