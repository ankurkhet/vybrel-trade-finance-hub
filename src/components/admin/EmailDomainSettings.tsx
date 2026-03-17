import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Mail, ExternalLink } from "lucide-react";

export function EmailDomainSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-5 w-5 text-primary" />
          Email Domain Configuration
        </CardTitle>
        <CardDescription>
          Configure a custom sender domain so emails come from your brand (e.g., notify@yourdomain.com)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">Set up your email domain</p>
            <p className="text-sm text-muted-foreground mt-1">
              Email domains let your emails come from your own brand instead of the default.
              This improves deliverability and builds trust with your users.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Open the email domain setup from the Cloud settings to configure DNS records and verify your domain.
            </p>
            <Badge variant="secondary" className="text-xs">
              Navigate to Cloud → Emails to manage your email domain
            </Badge>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">How it works</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Add your domain and configure DNS records (A, TXT)</li>
            <li>DNS verification typically takes a few minutes to 72 hours</li>
            <li>Once verified, all auth and notification emails will come from your domain</li>
            <li>SSL certificates are provisioned automatically</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
