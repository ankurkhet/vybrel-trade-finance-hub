import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
  mimeType?: string | null;
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  filePath,
  fileName,
  mimeType,
}: DocumentPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUrl = async () => {
    if (url) return;
    setLoading(true);
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 600);
    if (error || !data?.signedUrl) {
      toast.error("Could not load document");
      setLoading(false);
      return;
    }
    setUrl(data.signedUrl);
    setLoading(false);
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) loadUrl();
    else setUrl(null);
    onOpenChange(isOpen);
  };

  const isPdf = mimeType?.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isImage = mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <span className="truncate">{fileName}</span>
            {url && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={url} download={fileName}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </a>
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-[400px] flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : url ? (
            isPdf ? (
              <iframe
                src={url}
                className="w-full h-[70vh] rounded-md border"
                title={fileName}
              />
            ) : isImage ? (
              <img
                src={url}
                alt={fileName}
                className="max-w-full max-h-[70vh] object-contain rounded-md"
              />
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Preview not available for this file type.
                </p>
                <Button asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open in New Tab
                  </a>
                </Button>
              </div>
            )
          ) : (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Helper hook for document preview */
export function useDocumentPreview() {
  const [preview, setPreview] = useState<{
    filePath: string;
    fileName: string;
    mimeType?: string | null;
  } | null>(null);

  const openPreview = (filePath: string, fileName: string, mimeType?: string | null) => {
    setPreview({ filePath, fileName, mimeType });
  };

  const closePreview = () => setPreview(null);

  return { preview, openPreview, closePreview };
}
