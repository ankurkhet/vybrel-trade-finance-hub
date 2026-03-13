import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { LabellingMode } from "@/lib/branding-types";
import { Building2, Handshake, Globe } from "lucide-react";

interface LabellingModeSelectorProps {
  value: LabellingMode;
  onChange: (mode: LabellingMode) => void;
  disabled?: boolean;
}

const modes: {
  value: LabellingMode;
  label: string;
  description: string;
  details: string[];
  icon: typeof Building2;
  badge?: string;
}[] = [
  {
    value: "white_label",
    label: "White Label",
    description: "Full originator branding — no Vybrel mention anywhere",
    details: [
      "Originator's logo on all screens",
      "Custom colors and fonts throughout",
      "Custom login page branding",
      "Originator's name in page titles",
      "Custom domain support",
      "Branded emails from originator",
    ],
    icon: Building2,
    badge: "Premium",
  },
  {
    value: "joint_label",
    label: "Joint Label",
    description: "Originator branding with 'Powered by Vybrel' attribution",
    details: [
      "Originator's logo prominently displayed",
      "Custom colors and fonts",
      "'Powered by Vybrel' badge in sidebar footer",
      "Joint branding on login page",
      "Co-branded emails",
    ],
    icon: Handshake,
  },
  {
    value: "platform_label",
    label: "Platform Label",
    description: "Standard Vybrel branding throughout the portal",
    details: [
      "Vybrel logo and branding everywhere",
      "Standard Vybrel color scheme",
      "Vybrel domain",
      "Vybrel-branded emails",
      "No originator customization",
    ],
    icon: Globe,
  },
];

export function LabellingModeSelector({ value, onChange, disabled }: LabellingModeSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Labelling Mode</CardTitle>
        <CardDescription>
          {disabled
            ? "This setting is controlled by Vybrel during originator onboarding"
            : "Choose how this originator's portal will be branded"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as LabellingMode)}
          className="space-y-3"
          disabled={disabled}
        >
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`flex cursor-pointer gap-4 rounded-xl border p-4 transition-all hover:bg-accent/50 
                ${value === mode.value ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}
                ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <RadioGroupItem value={mode.value} className="mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <mode.icon className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">{mode.label}</span>
                  {mode.badge && <Badge variant="secondary" className="text-xs">{mode.badge}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
                <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {mode.details.map((d) => (
                    <li key={d} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
