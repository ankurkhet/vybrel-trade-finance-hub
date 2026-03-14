import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Hexagon, Building2, Users, BarChart3, FileCheck, Shield } from "lucide-react";
import { toast } from "sonner";

const roles = [
  { key: "admin", label: "Vybrel Admin", icon: Shield, desc: "Platform governance" },
  { key: "originator", label: "Originator", icon: Building2, desc: "Manage borrowers & invoices" },
  { key: "borrower", label: "Borrower", icon: Users, desc: "Submit documents & financing" },
  { key: "funder", label: "Lender / Funder", icon: BarChart3, desc: "Portfolio & deals" },
  { key: "counterparty", label: "Counterparty", icon: FileCheck, desc: "Invoice verification" },
];

export default function Auth() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

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

  // Step 1: Role selection
  if (!selectedRole) {
    return (
      <div className="flex min-h-screen flex-col bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))]" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <header className="flex items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Hexagon className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <span className="text-xl font-semibold tracking-tight">Vybrel</span>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/85 font-medium">
              Register as Originator
            </Button>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Welcome to <span className="text-primary">Vybrel</span>
              </h1>
              <p className="mt-2 text-sm opacity-55">
                Select your role to continue to sign in
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setSelectedRole(r.key)}
                  className="group flex items-start gap-4 rounded-xl border border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark-secondary))] p-5 text-left transition-all duration-200 hover:border-primary/30"
                >
                  <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
                  <div>
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="mt-0.5 text-xs opacity-50">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-8 text-center text-xs opacity-30">
              Access is by invitation only. Your role determines what you see.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Login form
  const activeRole = roles.find((r) => r.key === selectedRole)!;

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))]" style={{ fontFamily: "'Outfit', sans-serif" }}>
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
              onClick={() => setSelectedRole(null)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <activeRole.icon className="h-3.5 w-3.5" />
              {activeRole.label}
              <span className="opacity-50">· Change</span>
            </button>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>Sign In</h1>
          </div>

          <Card className="border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark-secondary))] text-[hsl(var(--surface-dark-foreground))]">
            <form onSubmit={handleLogin}>
              <CardHeader className="pb-4">
                <CardDescription className="opacity-55">
                  Sign in with your credentials or Google account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] hover:bg-[hsl(var(--surface-dark))]/80"
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
                  <Separator className="bg-[hsl(var(--surface-dark-tertiary))]" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--surface-dark-secondary))] px-3 text-xs opacity-40">
                    or
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-email" className="opacity-70">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] placeholder:opacity-30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="opacity-70">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="border-[hsl(var(--surface-dark-tertiary))] bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] placeholder:opacity-30"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/85 font-medium"
                  disabled={loading || oauthLoading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
                <Link to="/forgot-password" className="text-sm opacity-45 hover:text-primary hover:opacity-100 transition-all">
                  Forgot password?
                </Link>
              </CardFooter>
            </form>
          </Card>

          <p className="mt-6 text-center text-xs opacity-35">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Register as an Originator
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
