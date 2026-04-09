import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const TEMPLATE_TYPES = [
  { value: "nda", label: "Non-Disclosure Agreement (NDA)", description: "Boilerplate NDA signed during borrower onboarding." },
  { value: "facility_offer", label: "Facility Offer Letter", description: "Standard facility offer generated post-approval." },
  { value: "legal_agreement", label: "Legal Agreement", description: "Core legal contract binding the factoring relationship." },
  { value: "letter_of_assignment", label: "Letter of Assignment", description: "Notice of Assignment sent to Debtors." },
];

interface DocumentTemplate {
  id: string;
  template_type: string;
  template_name: string;
  file_path: string;
  is_active: boolean;
  created_at: string;
}

export default function DocumentTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchTemplates();
    }
  }, [profile]);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("document_templates" as any)
      .select("*")
      .eq("organization_id", profile!.organization_id)
      .eq("is_active", true);

    if (error) {
      toast.error("Failed to load templates: " + error.message);
    } else {
      setTemplates((data as unknown as DocumentTemplate[]) || []);
    }
    setLoading(false);
  };

  const handleUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.organization_id) return;
    
    // Validate file type
    if (file.type !== "application/pdf" && !file.name.endsWith(".docx")) {
      toast.error("Only PDF or DOCX files are supported for templates.");
      return;
    }

    setUploading(docType);
    try {
      // 1. Upload to storage
      const filePath = `templates/${profile.organization_id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("org-documents").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      // 2. Archive existing template of this type if exists
      const existing = templates.find(t => t.template_type === docType);
      if (existing) {
        await supabase
          .from("document_templates" as any)
          .update({ is_active: false })
          .eq("id", existing.id);
      }

      // 3. Insert new template record
      const { error: insertErr } = await supabase
        .from("document_templates" as any)
        .insert({
          organization_id: profile.organization_id,
          template_type: docType,
          template_name: file.name,
          file_path: filePath,
          is_active: true,
        });

      if (insertErr) throw insertErr;

      toast.success("Template uploaded successfully");
      await fetchTemplates();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template? Future document generations will require a new template.")) return;
    
    const { error } = await supabase
      .from("document_templates" as any)
      .update({ is_active: false })
      .eq("id", templateId);

    if (error) {
      toast.error("Failed to delete template: " + error.message);
    } else {
      toast.success("Template deleted");
      await fetchTemplates();
    }
  };

  const viewFile = async (filePath: string) => {
    const { data } = await supabase.storage.from("org-documents").createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not open file");
  };

  if (!profile?.organization_id) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">No organization assigned</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Templates</h1>
          <p className="text-sm text-muted-foreground">Manage boilerplate templates used for onboarding and contract generation.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {TEMPLATE_TYPES.map((typeObj) => {
              const activeTemplate = templates.find(t => t.template_type === typeObj.value);
              
              return (
                <Card key={typeObj.value}>
                  <CardContent className="p-5 flex flex-col sm:flex-row gap-4 justify-between h-full">
                    <div className="space-y-1 w-full sm:w-1/2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground">{typeObj.label}</h3>
                        {activeTemplate ? (
                          <Badge className="bg-green-600 text-[10px] ml-2">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] ml-2">Missing</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground pl-7">{typeObj.description}</p>
                    </div>

                    <div className="w-full sm:w-1/2 flex items-center justify-end">
                      {activeTemplate ? (
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:justify-end">
                          <div className="text-right">
                            <p 
                              className="text-sm font-medium text-primary hover:underline cursor-pointer truncate max-w-[200px]" 
                              title={activeTemplate.template_name}
                              onClick={() => viewFile(activeTemplate.file_path)}
                            >
                              {activeTemplate.template_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activeTemplate.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => viewFile(activeTemplate.file_path)}>
                              <Eye className="mr-1 h-3.5 w-3.5" /> View
                            </Button>
                            <Label className="cursor-pointer">
                              <Input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf,.doc,.docx" 
                                onChange={(e) => handleUpload(typeObj.value, e)} 
                                disabled={uploading === typeObj.value} 
                              />
                              <Button variant="outline" size="sm" disabled={uploading === typeObj.value} asChild>
                                <span>
                                  {uploading === typeObj.value ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                                  Replace
                                </span>
                              </Button>
                            </Label>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(activeTemplate.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Label className="cursor-pointer">
                            <Input 
                              type="file" 
                              className="hidden" 
                              accept=".pdf,.doc,.docx" 
                              onChange={(e) => handleUpload(typeObj.value, e)} 
                              disabled={uploading === typeObj.value} 
                            />
                            <Button asChild disabled={uploading === typeObj.value}>
                              <span>
                                {uploading === typeObj.value ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Upload Template
                              </span>
                            </Button>
                          </Label>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Ensure Label is used cleanly manually to avoid missing ui/label errors
const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <label className={className}>{children}</label>
);
