import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  FileText,
  Brain,
  BarChart3,
  Users,
  Lock,
  ArrowRight,
  Building2,
  Globe,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Invoice & Contract Management",
    description:
      "Digitise receivables, match invoices to contracts with AI, and manage the full lifecycle from origination to settlement.",
  },
  {
    icon: Brain,
    title: "AI-Powered Credit Analysis",
    description:
      "Automated credit memos, document analysis, and risk scoring powered by advanced language models—reducing turnaround from days to minutes.",
  },
  {
    icon: Shield,
    title: "Banking-Grade Security",
    description:
      "MFA, role-based access control, 15-minute idle timeouts, invitation-only onboarding, and full audit trails for every action.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Reporting",
    description:
      "Customisable dashboards for every stakeholder—admin, originator, borrower, and funder—with exportable analytics.",
  },
  {
    icon: Building2,
    title: "Multi-Tenant White-Label",
    description:
      "Each originator gets their own branded portal with custom domains, logos, and colour schemes—powered by Vybrel underneath.",
  },
  {
    icon: Globe,
    title: "End-to-End Compliance",
    description:
      "Built-in KYC/KYB document collection, approval workflows, and automated onboarding status tracking for every counterparty.",
  },
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

const actors = [
  { label: "Vybrel Admin", description: "Platform governance & compliance oversight" },
  { label: "Originator", description: "Manage borrowers, contracts & invoices" },
  { label: "Borrower", description: "Submit documents & track financing" },
  { label: "Lender / Funder", description: "Portfolio analytics & deal participation" },
  { label: "Counterparty", description: "Invoice verification & settlement" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Vybrel</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#portals" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Portals
            </a>
            <a href="#team" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Team
            </a>
          </nav>
          <Link to="/auth">
            <Button size="sm">
              Sign In <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(217_91%_40%/0.15),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              Banking-grade security · Invitation-only access
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Trade Finance,{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Reimagined
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Vybrel is a multi-tenant invoice financing platform that connects originators, borrowers,
              lenders, and counterparties on a single, AI-powered, compliance-first infrastructure.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/auth">
                <Button size="lg" className="min-w-[180px]">
                  Sign In to Your Portal
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="min-w-[180px]">
                  Explore Features
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Why Vybrel?</h2>
            <p className="mt-3 text-muted-foreground">
              Purpose-built for the complexities of trade finance—from origination to settlement.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/60 bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Portals */}
      <section id="portals" className="border-t py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Role-Based Portals</h2>
            <p className="mt-3 text-muted-foreground">
              Every stakeholder gets a tailored experience with the right data, tools, and permissions.
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actors.map((a) => (
              <div
                key={a.label}
                className="flex items-start gap-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">{a.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/auth">
              <Button>
                Sign In to Your Portal <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Leadership Team</h2>
            <p className="mt-3 text-muted-foreground">
              Deep domain expertise in trade finance, technology, and regulatory compliance.
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((t) => (
              <Card key={t.name} className="border-border/60 bg-card text-center">
                <CardContent className="p-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="mt-0.5 text-xs font-medium text-primary">{t.role}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Vybrel</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/dpa" className="hover:text-foreground">DPA</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Vybrel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
