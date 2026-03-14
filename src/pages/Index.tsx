import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  Brain,
  Shield,
  BarChart3,
  Building2,
  Globe,
  ChevronRight,
  Users,
} from "lucide-react";

const services = [
  {
    num: "01",
    title: "Invoice Discounting",
    desc: "Unlock cash from outstanding invoices before they mature.",
  },
  {
    num: "02",
    title: "Receivables Financing",
    desc: "Cross-border receivable solutions for global trade.",
  },
  {
    num: "03",
    title: "Payable Financing / SCF",
    desc: "Reverse factoring and supply-chain finance programmes.",
  },
  {
    num: "04",
    title: "Working Capital Revolving Loan",
    desc: "Flexible revolving facilities backed by trade assets.",
  },
  {
    num: "05",
    title: "AI-Powered Credit Analysis",
    desc: "Automated credit memos and risk scoring in minutes.",
  },
  {
    num: "06",
    title: "Multi-Tenant White-Label",
    desc: "Custom-branded portals for every originator organisation.",
  },
];

const capabilities = [
  { icon: FileText, label: "Invoice & Contract Management" },
  { icon: Brain, label: "AI Credit Memos & Risk Scoring" },
  { icon: Shield, label: "Banking-Grade Security & MFA" },
  { icon: BarChart3, label: "Real-Time Portfolio Reporting" },
  { icon: Building2, label: "KYC/KYB Compliance Workflows" },
  { icon: Globe, label: "End-to-End Multi-Tenant Platform" },
];

const team = [
  {
    name: "Rajiv Menon",
    role: "Chief Executive Officer",
    bio: "20+ years in structured trade finance across Asia and the Middle East.",
  },
  {
    name: "Ananya Sharma",
    role: "Chief Technology Officer",
    bio: "Former VP Engineering at a leading fintech, specialising in secure distributed systems.",
  },
  {
    name: "David Okoro",
    role: "Head of Risk & Compliance",
    bio: "Ex-regulator with deep expertise in AML, KYC frameworks, and credit risk modelling.",
  },
  {
    name: "Lena Fischer",
    role: "Head of Product",
    bio: "Product leader passionate about turning complex financial workflows into intuitive experiences.",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen font-sans">
      {/* ─── HERO (Dark navy, full-bleed) ─── */}
      <section className="relative min-h-screen bg-[hsl(222,47%,8%)] text-[hsl(210,40%,96%)] overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,hsl(222,47%,16%),transparent)]" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(42,78%,50%)] text-[hsl(42,78%,50%)]">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-wide">VYBREL</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#services" className="text-sm text-[hsl(210,40%,96%)]/60 transition-colors hover:text-[hsl(42,78%,50%)]">
              Services
            </a>
            <a href="#platform" className="text-sm text-[hsl(210,40%,96%)]/60 transition-colors hover:text-[hsl(42,78%,50%)]">
              Platform
            </a>
            <a href="#team" className="text-sm text-[hsl(210,40%,96%)]/60 transition-colors hover:text-[hsl(42,78%,50%)]">
              Team
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-[hsl(210,40%,96%)]/80 hover:text-[hsl(42,78%,50%)] hover:bg-transparent">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(42,78%,50%)] text-[hsl(222,47%,8%)] hover:bg-[hsl(42,78%,60%)] font-semibold">
                Get Started
              </Button>
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-32 lg:px-8 lg:pt-36">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(42,78%,50%)]">
            Trade Finance Infrastructure
          </p>
          <h1 className="max-w-3xl text-5xl font-light leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Financing that{" "}
            <span className="font-normal text-[hsl(42,78%,50%)]">moves</span> with
            your business
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-[hsl(210,40%,96%)]/60">
            A multi-tenant platform connecting originators, borrowers, lenders, and
            counterparties—powered by AI and built on banking-grade security.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(42,78%,50%)] text-[hsl(222,47%,8%)] hover:bg-[hsl(42,78%,60%)] font-semibold min-w-[200px]">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="border-[hsl(210,40%,96%)]/20 text-[hsl(210,40%,96%)] hover:bg-[hsl(222,47%,14%)] min-w-[200px]">
                Sign In to Portal
              </Button>
            </Link>
          </div>
        </div>

        {/* Bottom divider line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(42,78%,50%)]/30 to-transparent" />
      </section>

      {/* ─── SERVICES ─── */}
      <section id="services" className="bg-[hsl(222,47%,6%)] text-[hsl(210,40%,96%)] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(42,78%,50%)]">
            What we do
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
            Working Capital Solutions
          </h2>

          <div className="mt-16 grid gap-px bg-[hsl(222,35%,18%)]/50 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.num}
                className="group bg-[hsl(222,47%,6%)] p-8 transition-colors hover:bg-[hsl(222,47%,10%)]"
              >
                <span className="text-xs font-medium text-[hsl(42,78%,50%)]">{s.num}</span>
                <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(210,40%,96%)]/50">
                  {s.desc}
                </p>
                <ChevronRight className="mt-4 h-4 w-4 text-[hsl(42,78%,50%)] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLATFORM CAPABILITIES ─── */}
      <section id="platform" className="bg-[hsl(222,47%,8%)] text-[hsl(210,40%,96%)] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(42,78%,50%)]">
              Platform
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
              Built for Trade Finance
            </h2>
            <p className="mt-4 text-[hsl(210,40%,96%)]/50">
              Every capability you need—from origination to settlement—on one secure infrastructure.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div
                key={c.label}
                className="flex items-start gap-4 rounded-lg border border-[hsl(222,35%,18%)] bg-[hsl(222,47%,10%)] p-6 transition-colors hover:border-[hsl(42,78%,50%)]/30"
              >
                <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(42,78%,50%)]" />
                <span className="text-sm font-medium leading-snug">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TEAM ─── */}
      <section id="team" className="bg-[hsl(222,47%,6%)] text-[hsl(210,40%,96%)] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(42,78%,50%)]">
              Leadership
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">Our Team</h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((t) => (
              <div key={t.name} className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[hsl(222,35%,18%)] bg-[hsl(222,47%,10%)]">
                  <Users className="h-8 w-8 text-[hsl(42,78%,50%)]/60" />
                </div>
                <h3 className="font-medium">{t.name}</h3>
                <p className="mt-0.5 text-xs font-medium text-[hsl(42,78%,50%)]">{t.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(210,40%,96%)]/50">{t.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="bg-[hsl(222,47%,8%)] text-[hsl(210,40%,96%)] py-24">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[hsl(210,40%,96%)]/50">
            Register as an originator today and choose a plan that fits your business.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(42,78%,50%)] text-[hsl(222,47%,8%)] hover:bg-[hsl(42,78%,60%)] font-semibold">
                View Plans <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[hsl(222,35%,18%)] bg-[hsl(222,47%,6%)] py-10 text-[hsl(210,40%,96%)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[hsl(42,78%,50%)]" />
            <span className="text-sm font-semibold tracking-wide">VYBREL</span>
          </div>
          <div className="flex gap-6 text-sm text-[hsl(210,40%,96%)]/50">
            <Link to="/privacy" className="hover:text-[hsl(42,78%,50%)]">Privacy</Link>
            <Link to="/terms" className="hover:text-[hsl(42,78%,50%)]">Terms</Link>
            <Link to="/dpa" className="hover:text-[hsl(42,78%,50%)]">DPA</Link>
          </div>
          <p className="text-xs text-[hsl(210,40%,96%)]/40">
            © {new Date().getFullYear()} Vybrel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
