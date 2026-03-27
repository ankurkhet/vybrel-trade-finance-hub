import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, Trash2, Monitor, Smartphone, Laptop } from "lucide-react";

interface TrustedDevice {
  id: string;
  name: string;
  type: "desktop" | "mobile" | "tablet";
  lastUsed: string;
  current: boolean;
}

interface IPWhitelistEntry {
  id: string;
  ip: string;
  label: string;
}

export function SecuritySettings() {
  const [ipWhitelisting, setIpWhitelisting] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [ipList, setIpList] = useState<IPWhitelistEntry[]>([]);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [deviceTrust, setDeviceTrust] = useState(true);

  // Editable session settings
  const [idleTimeout, setIdleTimeout] = useState("15");
  const [maxSessions, setMaxSessions] = useState("3");
  const [editingSession, setEditingSession] = useState(false);

  const [devices] = useState<TrustedDevice[]>([
    { id: "1", name: "Chrome on Windows", type: "desktop", lastUsed: "2026-03-13", current: true },
    { id: "2", name: "Safari on iPhone", type: "mobile", lastUsed: "2026-03-12", current: false },
  ]);

  const DeviceIcon = (type: string) => {
    switch (type) {
      case "mobile": return <Smartphone className="h-4 w-4" />;
      case "tablet": return <Laptop className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const addIp = () => {
    if (newIp && newIpLabel) {
      setIpList([...ipList, { id: Date.now().toString(), ip: newIp, label: newIpLabel }]);
      setNewIp("");
      setNewIpLabel("");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Security Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure banking-grade security for your organization
        </p>
      </div>

      {/* Session Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Session Management
          </CardTitle>
          <CardDescription>Configure session timeout and concurrent session limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium text-foreground">Auto-logout on idle</p>
              <p className="text-sm text-muted-foreground">Sessions expire after inactivity</p>
            </div>
            {editingSession ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={idleTimeout}
                  onChange={(e) => setIdleTimeout(e.target.value)}
                  className="w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            ) : (
              <Badge variant="secondary">{idleTimeout} min</Badge>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium text-foreground">Concurrent session limit</p>
              <p className="text-sm text-muted-foreground">Maximum active sessions per user</p>
            </div>
            {editingSession ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={maxSessions}
                  onChange={(e) => setMaxSessions(e.target.value)}
                  className="w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">sessions</span>
              </div>
            ) : (
              <Badge variant="secondary">{maxSessions} sessions</Badge>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Force re-authentication</p>
              <p className="text-sm text-muted-foreground">Require password for sensitive actions (settings, financial ops)</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex justify-end">
            <Button
              variant={editingSession ? "default" : "outline"}
              size="sm"
              onClick={() => setEditingSession(!editingSession)}
            >
              {editingSession ? "Save Changes" : "Edit Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* IP Whitelisting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IP Whitelisting</CardTitle>
          <CardDescription>Restrict platform access to trusted IP addresses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable IP restrictions</p>
              <p className="text-sm text-muted-foreground">Only allow access from whitelisted IPs</p>
            </div>
            <Switch checked={ipWhitelisting} onCheckedChange={setIpWhitelisting} />
          </div>

          {ipWhitelisting && (
            <>
              <Separator />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="IP address (e.g., 192.168.1.0/24)"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Label (e.g., Office)"
                  value={newIpLabel}
                  onChange={(e) => setNewIpLabel(e.target.value)}
                  className="w-full sm:w-40"
                />
                <Button onClick={addIp} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {ipList.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-mono text-sm text-foreground">{entry.ip}</p>
                    <p className="text-xs text-muted-foreground">{entry.label}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIpList(ipList.filter((i) => i.id !== entry.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Device Trust */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trusted Devices</CardTitle>
          <CardDescription>Manage trusted devices and receive alerts for new device logins</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="device-trust" className="flex flex-col gap-1">
              <span className="font-medium">Device trust management</span>
              <span className="text-sm font-normal text-muted-foreground">Remember trusted devices</span>
            </Label>
            <Switch id="device-trust" checked={deviceTrust} onCheckedChange={setDeviceTrust} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="login-alerts" className="flex flex-col gap-1">
              <span className="font-medium">New device login alerts</span>
              <span className="text-sm font-normal text-muted-foreground">Email notification on unrecognized device login</span>
            </Label>
            <Switch id="login-alerts" checked={loginAlerts} onCheckedChange={setLoginAlerts} />
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Active Devices</p>
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  {DeviceIcon(device.type)}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {device.name}
                      {device.current && (
                        <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Last used: {device.lastUsed}</p>
                  </div>
                </div>
                {!device.current && (
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
