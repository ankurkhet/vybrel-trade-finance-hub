import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, GripVertical } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price_gbp: number;
  max_borrowers: number;
  max_funders: number;
  max_monthly_volume_gbp: number;
  features: string[];
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

export default function AdminProducts() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState<Record<string, string>>({});

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error("Failed to load plans");
    } else {
      setPlans((data as unknown as Plan[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const updatePlan = (id: string, field: keyof Plan, value: unknown) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const savePlan = async (plan: Plan) => {
    setSaving(plan.id);
    const { error } = await supabase
      .from("subscription_plans")
      .update({
        name: plan.name,
        price_gbp: plan.price_gbp,
        max_borrowers: plan.max_borrowers,
        max_funders: plan.max_funders,
        max_monthly_volume_gbp: plan.max_monthly_volume_gbp,
        features: plan.features as unknown as Record<string, unknown>[],
        is_active: plan.is_active,
        is_popular: plan.is_popular,
        sort_order: plan.sort_order,
      })
      .eq("id", plan.id);
    setSaving(null);
    if (error) {
      toast.error("Failed to save plan: " + error.message);
    } else {
      toast.success(`"${plan.name}" updated successfully`);
    }
  };

  const addPlan = async () => {
    const { data, error } = await supabase
      .from("subscription_plans")
      .insert({
        name: "New Plan",
        price_gbp: 0,
        max_borrowers: 10,
        max_funders: 5,
        max_monthly_volume_gbp: 100000,
        features: [] as unknown as Record<string, unknown>[],
        sort_order: plans.length + 1,
      })
      .select()
      .single();
    if (error) {
      toast.error("Failed to create plan");
    } else if (data) {
      setPlans((prev) => [...prev, data as unknown as Plan]);
      toast.success("New plan created");
    }
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase
      .from("subscription_plans")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete plan");
    } else {
      setPlans((prev) => prev.filter((p) => p.id !== id));
      toast.success("Plan deleted");
    }
  };

  const addFeature = (planId: string) => {
    const text = newFeature[planId]?.trim();
    if (!text) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    updatePlan(planId, "features", [...plan.features, text]);
    setNewFeature((prev) => ({ ...prev, [planId]: "" }));
  };

  const removeFeature = (planId: string, index: number) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    updatePlan(
      planId,
      "features",
      plan.features.filter((_, i) => i !== index)
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Product Configuration</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage subscription plans displayed to originators. All prices in GBP.
            </p>
          </div>
          <Button onClick={addPlan} className="bg-primary text-primary-foreground hover:bg-primary/85">
            <Plus className="mr-2 h-4 w-4" /> Add Plan
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id} className="border-border">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-2">
                        {plan.is_active ? (
                          <Badge variant="default" className="bg-success text-success-foreground text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {plan.is_popular && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Popular</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deletePlan(plan.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Basic info */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Plan Name</Label>
                      <Input
                        value={plan.name}
                        onChange={(e) => updatePlan(plan.id, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Fee (£)</Label>
                      <Input
                        type="number"
                        value={plan.price_gbp}
                        onChange={(e) => updatePlan(plan.id, "price_gbp", Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Max Borrowers</Label>
                      <Input
                        type="number"
                        value={plan.max_borrowers}
                        onChange={(e) => updatePlan(plan.id, "max_borrowers", Number(e.target.value))}
                        placeholder="-1 for unlimited"
                      />
                      <p className="text-xs text-muted-foreground">-1 = unlimited</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Funders</Label>
                      <Input
                        type="number"
                        value={plan.max_funders}
                        onChange={(e) => updatePlan(plan.id, "max_funders", Number(e.target.value))}
                        placeholder="-1 for unlimited"
                      />
                      <p className="text-xs text-muted-foreground">-1 = unlimited</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Volume (£)</Label>
                      <Input
                        type="number"
                        value={plan.max_monthly_volume_gbp}
                        onChange={(e) =>
                          updatePlan(plan.id, "max_monthly_volume_gbp", Number(e.target.value))
                        }
                        placeholder="-1 for unlimited"
                      />
                      <p className="text-xs text-muted-foreground">-1 = unlimited</p>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={plan.is_active}
                        onCheckedChange={(v) => updatePlan(plan.id, "is_active", v)}
                      />
                      <Label className="text-sm">Active</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={plan.is_popular}
                        onCheckedChange={(v) => updatePlan(plan.id, "is_popular", v)}
                      />
                      <Label className="text-sm">Mark as Popular</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Sort Order</Label>
                      <Input
                        type="number"
                        value={plan.sort_order}
                        onChange={(e) => updatePlan(plan.id, "sort_order", Number(e.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Features */}
                  <div className="space-y-3">
                    <Label>Features</Label>
                    <div className="space-y-2">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm">
                            {f}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => removeFeature(plan.id, i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newFeature[plan.id] || ""}
                        onChange={(e) =>
                          setNewFeature((prev) => ({ ...prev, [plan.id]: e.target.value }))
                        }
                        placeholder="Add a feature..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature(plan.id))}
                      />
                      <Button variant="outline" size="sm" onClick={() => addFeature(plan.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/85"
                    onClick={() => savePlan(plan)}
                    disabled={saving === plan.id}
                  >
                    {saving === plan.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
