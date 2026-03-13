export interface PasswordCheck {
  label: string;
  met: boolean;
}

export function validatePassword(password: string): PasswordCheck[] {
  return [
    { label: "At least 12 characters", met: password.length >= 12 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "Number (0-9)", met: /[0-9]/.test(password) },
    { label: "Special character (!@#$%^&*…)", met: /[^A-Za-z0-9]/.test(password) },
    { label: "No 3+ repeated characters", met: !/(.)\1{2,}/.test(password) },
    { label: "No common patterns (123, abc, qwerty)", met: !/(123|abc|qwerty|password|letmein)/i.test(password) },
  ];
}

export function isPasswordStrong(password: string): boolean {
  return validatePassword(password).every((c) => c.met);
}

export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const checks = validatePassword(password);
  const passed = checks.filter((c) => c.met).length;
  const ratio = passed / checks.length;

  if (ratio <= 0.3) return { score: passed, label: "Weak", color: "bg-destructive" };
  if (ratio <= 0.6) return { score: passed, label: "Fair", color: "bg-orange-500" };
  if (ratio < 1) return { score: passed, label: "Good", color: "bg-yellow-500" };
  return { score: passed, label: "Strong", color: "bg-green-500" };
}
