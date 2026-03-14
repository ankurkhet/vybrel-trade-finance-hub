import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Check, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 500,
    borrowers: "Up to 10 borrowers",
    txn: "Up to $500K transactions / month",
    features: [
      "AI credit memos",
      "KYC/KYB workflows",
      "Basic reporting",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 1000,
    borrowers: "Up to 50 borrowers",
    txn: "Up to $2M transactions / month",
    popular: true,
    features: [
      "Everything in Starter",
      "White-label branding",
      "Advanced AI insights",
      "Priority support",
      "Custom domain",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 3000,
    borrowers: "Unlimited borrowers",
    txn: "Unlimited transactions",
    features: [
      "Everything in Growth",
      "Dedicated account manager",
      "SLA guarantees",
      "SSO & advanced security",
      "API access",
      "Custom integrations",
    ],
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState<"plan" | "register">("plan");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: "",
  });

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
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Registration successful! Check your email to confirm your account.");
      navigate("/auth");
    }
  };

  // Step 1: Plan selection
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,8%)] text-[hsl(210,40%,96%)]">
        {/* Nav */}
        <header className="flex items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(42,78%,50%)] text-[hsl(42,78%,50%)]">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-wide">VYBREL</span>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-[hsl(210,40%,96%)]/80 hover:text-[hsl(42,78%,50%)] hover:bg-transparent">
              Already have an account? Sign In
            </Button>
          </Link>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(42,78%,50%)]">
              Originator Registration
            </p>
            <h1 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
              Choose your plan
            </h1>
            <p className="mt-3 text-[hsl(210,40%,96%)]/50">
              Select a subscription that matches your portfolio size and transaction volume.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-8 transition-all ${
                  selectedPlan === plan.id
                    ? "border-[hsl(42,78%,50%)] bg-[hsl(222,47%,12%)]"
                    : "border-[hsl(222,35%,18%)] bg-[hsl(222,47%,10%)] hover:border-[hsl(222,35%,24%)]"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(42,78%,50%)] px-4 py-1 text-xs font-semibold text-[hsl(222,47%,8%)]">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-medium">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-light text-[hsl(42,78%,50%)]">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-[hsl(210,40%,96%)]/50">/month</span>
                </div>
                <div className="mt-4 space-y-1.5">
                  <p className="text-sm font-medium">{plan.borrowers}</p>
                  <p className="text-sm text-[hsl(210,40%,96%)]/50">{plan.txn}</p>
                </div>

                <Separator className="my-6 bg-[hsl(222,35%,18%)]" />

                <ul className="flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[hsl(210,40%,96%)]/70">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(42,78%,50%)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`mt-8 w-full font-semibold ${
                    selectedPlan === plan.id
                      ? "bg-[hsl(42,78%,50%)] text-[hsl(222,47%,8%)] hover:bg-[hsl(42,78%,60%)]"
                      : "border border-[hsl(222,35%,18%)] bg-transparent text-[hsl(210,40%,96%)] hover:bg-[hsl(222,47%,14%)]"
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
        </div>
      </div>
    );
  }

  // Step 2: Registration form
  const activePlan = plans.find((p) => p.id === selectedPlan)!;

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(222,47%,8%)] text-[hsl(210,40%,96%)]">
      <header className="flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(42,78%,50%)] text-[hsl(42,78%,50%)]">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-wide">VYBREL</span>
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Plan indicator */}
          <div className="mb-6 text-center">
            <button
              onClick={() => setStep("plan")}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(42,78%,50%)]/30 bg-[hsl(222,47%,10%)] px-4 py-1.5 text-xs font-medium text-[hsl(42,78%,50%)] transition-colors hover:bg-[hsl(222,47%,14%)]"
            >
              {activePlan.name} · ${activePlan.price}/mo
              <span className="text-[hsl(210,40%,96%)]/40">· Change</span>
            </button>
            <h1 className="text-2xl font-light tracking-tight">Create Your Account</h1>
            <p className="mt-1 text-sm text-[hsl(210,40%,96%)]/50">Register as an Originator</p>
          </div>

          <Card className="border-[hsl(222,35%,18%)] bg-[hsl(222,47%,10%)] text-[hsl(210,40%,96%)]">
            <form onSubmit={handleRegister}>
              <CardHeader className="pb-2" />
              <CardContent className="space-y-4">
                {/* Google OAuth */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[hsl(222,35%,18%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,96%)] hover:bg-[hsl(222,47%,18%)] hover:text-[hsl(210,40%,96%)]"
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
                  <Separator className="bg-[hsl(222,35%,18%)]" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[hsl(222,47%,10%)] px-3 text-xs text-[hsl(210,40%,96%)]/40">
                    or register with email
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-[hsl(210,40%,96%)]/70">Full Name</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="border-[hsl(222,35%,18%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(210,40%,96%)]/30"
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(210,40%,96%)]/70">Company Name</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    className="border-[hsl(222,35%,18%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(210,40%,96%)]/30"
                    placeholder="Acme Finance Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(210,40%,96%)]/70">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="border-[hsl(222,35%,18%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(210,40%,96%)]/30"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(210,40%,96%)]/70">Password (min 12 characters)</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={12}
                    className="border-[hsl(222,35%,18%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(210,40%,96%)]/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(210,40%,96%)]/70">Confirm Password</Label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="border-[hsl(222,35%,18%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(210,40%,96%)]/30"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-[hsl(42,78%,50%)] text-[hsl(222,47%,8%)] hover:bg-[hsl(42,78%,60%)] font-semibold"
                  disabled={loading || oauthLoading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
                <p className="text-center text-xs text-[hsl(210,40%,96%)]/40">
                  By registering, you agree to our{" "}
                  <Link to="/terms" className="text-[hsl(42,78%,50%)] hover:underline">Terms</Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-[hsl(42,78%,50%)] hover:underline">Privacy Policy</Link>.
                </p>
              </CardFooter>
            </form>
          </Card>

          <p className="mt-6 text-center text-xs text-[hsl(210,40%,96%)]/40">
            Already have an account?{" "}
            <Link to="/auth" className="text-[hsl(42,78%,50%)] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
