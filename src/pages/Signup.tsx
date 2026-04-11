import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter as DialogFt } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Hexagon, Check, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const NDA_CONTENT = `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of electronic acceptance between Vybrel Limited ("Platform", "we", "us") and the Originator accepting this Agreement ("you", "Originator").

1. CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by the Platform or its clients including but not limited to: borrower financial data, funder terms, trade finance structures, pricing, proprietary algorithms, software, and business processes.

2. OBLIGATIONS
You agree to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for the purpose of using the Vybrel Platform to originate trade finance transactions; (d) protect Confidential Information with at least the same degree of care you use to protect your own confidential information, but no less than reasonable care.

3. PERMITTED DISCLOSURES
Disclosure is permitted where: (a) required by applicable law, court order, or regulatory authority (with prior notice to the Platform where legally permissible); (b) the information is or becomes publicly available through no fault of yours; (c) you received the information from a third party free of any obligation of confidentiality.

4. DATA PROTECTION
Both parties agree to comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018 in respect of any personal data processed under this Agreement. Personal data of borrowers, funders, and counterparties shall only be processed for purposes of originating and managing trade finance transactions on the Platform.

5. RETURN OF INFORMATION
Upon termination of your Platform access, you agree to promptly return or destroy all Confidential Information and certify such destruction upon request.

6. TERM
This Agreement shall remain in force for a period of five (5) years from the date of acceptance, and shall survive termination of your Platform subscription.

7. REMEDIES
You acknowledge that breach of this Agreement may cause irreparable harm for which monetary damages may be inadequate, and that the Platform shall be entitled to seek equitable relief including injunction in addition to all other remedies.

8. GOVERNING LAW
This Agreement shall be governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.

9. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior agreements and understandings.

By checking the acceptance box, you acknowledge that you have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.
`.trim();

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

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState<"plan" | "register">("plan");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [ndaOpen, setNdaOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: "",
  });

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

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result?.error) {
      toast.error("Google sign-in failed. Please try again.");
    }
    setOauthLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ndaAccepted) {
      toast.error("You must accept the Non-Disclosure Agreement to continue");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }
    setLoading(true);
    const { error } = await signUp(formData.email, formData.password, formData.fullName);
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // Record NDA acceptance — we capture metadata; user_id will be linked post-confirmation
    // Store in local storage so the post-confirmation hook can persist it
    localStorage.setItem("pending_nda_acceptance", JSON.stringify({
      actor_email: formData.email,
      document_type: "nda",
      document_version: "1.0",
      accepted_at: new Date().toISOString(),
      acceptance_method: "in_app_checkbox",
    }));
    setLoading(false);
    toast.success("Registration successful! Check your email to confirm your account.");
    navigate("/auth");
  };

  if (step === "plan") {
    return (
      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <header className="flex items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Hexagon className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <span className="text-xl font-semibold tracking-tight">Vybrel</span>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
              Already have an account? Sign In
            </Button>
          </Link>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Originator Registration</p>
            <h1 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Choose your plan
            </h1>
            <p className="mt-3 text-muted-foreground">
              Select a subscription that matches your portfolio size and transaction volume.
            </p>
          </div>

          {plans.length > 0 ? (
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-8 transition-colors ${
                    selectedPlan === plan.id
                      ? "border-primary/45 bg-card"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  {plan.is_popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-medium">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-light text-primary">£{plan.price_gbp.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm">
                    <p className="font-medium">
                      {plan.max_borrowers === -1 ? "Unlimited" : `Up to ${plan.max_borrowers}`} borrowers
                    </p>
                    <p className="text-muted-foreground">
                      {plan.max_funders === -1 ? "Unlimited" : `Up to ${plan.max_funders}`} funders
                    </p>
                    <p className="text-muted-foreground">
                      {plan.max_monthly_volume_gbp === -1
                        ? "Unlimited"
                        : `£${(plan.max_monthly_volume_gbp / 1000).toLocaleString()}K`} monthly volume
                    </p>
                  </div>

                  <Separator className="my-6 bg-border" />

                  <ul className="flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/85">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`mt-8 w-full font-medium ${
                      selectedPlan === plan.id
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-transparent text-foreground hover:bg-secondary"
                    }`}
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setStep("register");
                    }}
                  >
                    Select {plan.name} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-14 py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-3">Loading plans...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const activePlan = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <header className="flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <Hexagon className="h-7 w-7 text-primary" strokeWidth={1.5} />
          <span className="text-xl font-semibold tracking-tight">Vybrel</span>
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <button
              onClick={() => setStep("plan")}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {activePlan?.name} · £{activePlan?.price_gbp}/mo
              <span className="text-muted-foreground">· Change</span>
            </button>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Create Your Account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Register as an Originator</p>
          </div>

          <Card className="border-border bg-card text-card-foreground">
            <form onSubmit={handleRegister}>
              <CardHeader className="pb-2" />
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border bg-background text-foreground hover:bg-secondary"
                  disabled={oauthLoading || loading}
                  onClick={handleGoogleSignIn}
                >
                  {oauthLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <div className="relative">
                  <Separator className="bg-border" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    or register with email
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/85">Full Name</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/85">Company Name</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="Acme Finance Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/85">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/85">Password (min 12 characters)</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={12}
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/85">Confirm Password</Label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <div className="flex items-start gap-2 w-full rounded-lg border p-3 bg-muted/30">
                  <Checkbox
                    id="nda"
                    checked={ndaAccepted}
                    onCheckedChange={(v) => setNdaAccepted(!!v)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="nda" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
                    I have read and accept the{" "}
                    <button
                      type="button"
                      onClick={() => setNdaOpen(true)}
                      className="text-primary underline hover:text-primary/80 font-medium"
                    >
                      Non-Disclosure Agreement
                    </button>
                    {" "}required to access the Vybrel platform.
                  </Label>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  disabled={loading || oauthLoading || !ndaAccepted}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By registering, you also agree to our <Link to="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
                  <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* NDA Modal */}
          <Dialog open={ndaOpen} onOpenChange={setNdaOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Non-Disclosure Agreement v1.0</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{NDA_CONTENT}</pre>
              </ScrollArea>
              <DialogFt className="flex gap-2">
                <Button variant="outline" onClick={() => setNdaOpen(false)}>Close</Button>
                <Button onClick={() => { setNdaAccepted(true); setNdaOpen(false); }}>
                  <Check className="h-4 w-4 mr-1" />I Accept this Agreement
                </Button>
              </DialogFt>
            </DialogContent>
          </Dialog>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
