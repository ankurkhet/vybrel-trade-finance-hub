import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, Smartphone, Mail, KeyRound } from "lucide-react";

type MFAMethod = "totp" | "sms" | "email";

interface MFAEnrollmentProps {
  onComplete: (method: MFAMethod) => void;
  userEmail?: string;
  userPhone?: string;
}

export function MFAEnrollment({ onComplete, userEmail, userPhone }: MFAEnrollmentProps) {
  const [method, setMethod] = useState<MFAMethod>("totp");
  const [step, setStep] = useState<"select" | "verify">("select");
  const [code, setCode] = useState("");
  const [qrUrl] = useState(""); // Will be populated from Supabase MFA enrollment

  const handleEnroll = () => {
    // TODO: Call Supabase MFA enrollment API based on selected method
    setStep("verify");
  };

  const handleVerify = () => {
    // TODO: Verify the OTP code via Supabase
    onComplete(method);
  };

  if (step === "verify") {
    return (
      <Card className="mx-auto max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Verify Your Setup</CardTitle>
          <CardDescription>
            {method === "totp" && "Enter the 6-digit code from your authenticator app"}
            {method === "sms" && `Enter the code sent to ${userPhone || "your phone"}`}
            {method === "email" && `Enter the code sent to ${userEmail || "your email"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {method === "totp" && qrUrl && (
            <div className="flex justify-center rounded-lg border bg-card p-4">
              <img src={qrUrl} alt="QR Code" className="h-48 w-48" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="otp-code">Verification Code</Label>
            <Input
              id="otp-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <Button onClick={handleVerify} className="w-full" disabled={code.length !== 6}>
            Verify & Enable
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Set Up Two-Factor Authentication</CardTitle>
        <CardDescription>
          Choose your preferred verification method for securing your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as MFAMethod)} className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
            <RadioGroupItem value="totp" />
            <KeyRound className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Authenticator App</p>
              <p className="text-sm text-muted-foreground">Google Authenticator, Authy, or similar</p>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
            <RadioGroupItem value="sms" />
            <Smartphone className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-foreground">SMS Code</p>
              <p className="text-sm text-muted-foreground">Receive a code via text message</p>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
            <RadioGroupItem value="email" />
            <Mail className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Email Code</p>
              <p className="text-sm text-muted-foreground">Receive a code at your registered email</p>
            </div>
          </label>
        </RadioGroup>
        <Button onClick={handleEnroll} className="w-full">
          Continue Setup
        </Button>
      </CardContent>
    </Card>
  );
}
