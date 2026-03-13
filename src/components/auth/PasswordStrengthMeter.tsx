import { validatePassword, getPasswordStrength } from "@/lib/password-policy";
import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;

  const checks = validatePassword(password);
  const strength = getPasswordStrength(password);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Password strength</span>
        <span className={`font-semibold ${strength.label === "Strong" ? "text-green-600" : strength.label === "Weak" ? "text-destructive" : "text-foreground"}`}>
          {strength.label}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
          style={{ width: `${(strength.score / checks.length) * 100}%` }}
        />
      </div>
      <ul className="grid grid-cols-1 gap-0.5 text-xs">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-1.5">
            {check.met ? (
              <Check className="h-3 w-3 text-green-600 shrink-0" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className={check.met ? "text-foreground" : "text-muted-foreground"}>{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
