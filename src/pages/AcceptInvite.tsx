import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { isPasswordStrong } from "@/lib/password-policy";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link. No token provided.");
      setValidating(false);
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    const { data, error: err } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token!)
      .is("accepted_at", null)
      .single();

    if (err || !data) {
      setError("This invitation is invalid or has already been used.");
    } else {
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError("This invitation has expired. Please contact your administrator.");
      } else {
        setInvitation(data);
      }
    }
    setValidating(false);
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!isPasswordStrong(password)) {
      toast.error("Password does not meet security requirements");
      return;
    }

    setLoading(true);

    // Sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (signUpError) {
      toast.error(signUpError.message);
      setLoading(false);
      return;
    }

    // Call edge function to finalize the invitation (assign role, org, mark accepted)
    const { error: acceptError } = await supabase.functions.invoke("accept-invitation", {
      body: { token, user_id: signUpData.user?.id },
    });

    if (acceptError) {
      toast.error("Failed to finalize invitation. Please contact your administrator.");
      setLoading(false);
      return;
    }

    setLoading(false);
    toast.success("Account created! Please check your email to verify, then sign in.");
    navigate("/auth");
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Go to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vybrel</h1>
          <p className="text-sm text-muted-foreground">You've been invited to join the platform</p>
        </div>

        <Card>
          <form onSubmit={handleAccept}>
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Invitation for <span className="font-medium text-foreground">{invitation?.email}</span>
                {" "}as <span className="capitalize font-medium text-foreground">{invitation?.role?.replace("_", " ")}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 12 characters, mixed case, number & symbol"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <PasswordStrengthMeter password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
