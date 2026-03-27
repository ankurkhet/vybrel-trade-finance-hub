import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CheckCircle2, FileText, AlertCircle, Loader2 } from "lucide-react";
import { ONBOARDING_DOCUMENT_TYPES } from "@/lib/onboarding-types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadedDoc {
  type: string;
  name: string;
  path: string;
  size: number;
  uploaded_at: string;
}

interface DocumentChecklistStepProps {
  uploadedDocs: UploadedDoc[];
  onUpload: (doc: UploadedDoc) => void;
  notes: Record<string, string>;
  onNoteChange: (type: string, note: string) => void;
  disabled?: boolean;
  isSubmitted?: boolean;
}

export function DocumentChecklistStep({ uploadedDocs, onUpload, notes, onNoteChange, disabled, isSubmitted }: DocumentChecklistStepProps) {
  const [uploading, setUploading] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be under 20MB");
      return;
    }
    setUploading(docType);
    try {
      const filePath = `onboarding/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("documents").upload(filePath, file);
      if (error) throw error;
      onUpload({
        type: docType,
        name: file.name,
        path: filePath,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      });
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    }
    setUploading(null);
  };

  const requiredCount = ONBOARDING_DOCUMENT_TYPES.filter(d => d.required).length;
  const uploadedRequired = ONBOARDING_DOCUMENT_TYPES.filter(d => d.required && uploadedDocs.some(u => u.type === d.type)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Required Documents
        </CardTitle>
        <CardDescription>
          Upload all required documents. {uploadedRequired}/{requiredCount} mandatory documents uploaded.
          {isSubmitted && " You can still add additional documents."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mandatory section */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">Mandatory Documents</h4>
        </div>
        {ONBOARDING_DOCUMENT_TYPES.filter(d => d.required).map((doc) => {
          const uploaded = uploadedDocs.filter(u => u.type === doc.type);
          const latestUpload = uploaded[uploaded.length - 1];
          const isUploading = uploading === doc.type;

          return (
            <DocumentRow
              key={doc.type}
              doc={doc}
              latestUpload={latestUpload}
              uploadCount={uploaded.length}
              isUploading={isUploading}
              note={notes[doc.type] || ""}
              onNoteChange={(val) => onNoteChange(doc.type, val)}
              onFileChange={(e) => handleFileUpload(e, doc.type)}
              disabled={disabled}
              isSubmitted={isSubmitted}
            />
          );
        })}

        {/* Optional section */}
        <div className="space-y-1 pt-4 border-t">
          <h4 className="text-sm font-semibold text-foreground">Optional / Supporting Documents</h4>
        </div>
        {ONBOARDING_DOCUMENT_TYPES.filter(d => !d.required).map((doc) => {
          const uploaded = uploadedDocs.filter(u => u.type === doc.type);
          const latestUpload = uploaded[uploaded.length - 1];
          const isUploading = uploading === doc.type;

          return (
            <DocumentRow
              key={doc.type}
              doc={doc}
              latestUpload={latestUpload}
              uploadCount={uploaded.length}
              isUploading={isUploading}
              note={notes[doc.type] || ""}
              onNoteChange={(val) => onNoteChange(doc.type, val)}
              onFileChange={(e) => handleFileUpload(e, doc.type)}
              disabled={disabled}
              isSubmitted={isSubmitted}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

function DocumentRow({
  doc,
  latestUpload,
  uploadCount,
  isUploading,
  note,
  onNoteChange,
  onFileChange,
  disabled,
  isSubmitted,
}: {
  doc: { type: string; label: string; required: boolean };
  latestUpload?: UploadedDoc;
  uploadCount: number;
  isUploading: boolean;
  note: string;
  onNoteChange: (val: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  isSubmitted?: boolean;
}) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {latestUpload ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--chart-2))]" />
          ) : doc.required ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.label}</p>
            {latestUpload && (
              <p className="text-xs text-muted-foreground truncate">
                {latestUpload.name}
                {uploadCount > 1 && ` (+${uploadCount - 1} more)`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {doc.required && <Badge variant="outline" className="text-xs">Required</Badge>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowNote(!showNote)}
          >
            Note
          </Button>
          {/* Allow uploads when not fully disabled; after submit allow adding but not deleting */}
          {(!disabled || isSubmitted) && (
            <Label className="cursor-pointer">
              <Input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={onFileChange}
                disabled={isUploading}
              />
              <Badge variant={latestUpload ? "secondary" : "default"} className="cursor-pointer">
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : latestUpload ? "Add" : "Upload"}
              </Badge>
            </Label>
          )}
        </div>
      </div>
      {showNote && (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a note about this document..."
          rows={2}
          className="text-sm"
          disabled={disabled && !isSubmitted}
        />
      )}
    </div>
  );
}
