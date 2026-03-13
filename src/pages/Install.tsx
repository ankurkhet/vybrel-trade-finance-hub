import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, Tablet } from "lucide-react";

export default function Install() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Download className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Install Vybrel</CardTitle>
          <CardDescription>
            Install the app on your device for quick access and offline support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">iPhone / iPad</h3>
                <p className="text-sm text-muted-foreground">
                  Tap the Share button in Safari, then select "Add to Home Screen"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Android</h3>
                <p className="text-sm text-muted-foreground">
                  Tap the browser menu (⋮) and select "Install app" or "Add to Home Screen"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <Monitor className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Desktop</h3>
                <p className="text-sm text-muted-foreground">
                  Click the install icon in your browser's address bar
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <Tablet className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Tablet</h3>
                <p className="text-sm text-muted-foreground">
                  Same as your phone — use the share or browser menu to install
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={() => window.history.back()}>
            Back to App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
