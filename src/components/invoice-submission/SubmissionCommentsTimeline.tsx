import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Submission {
  id: string;
  request_number: string | null;
  submitted_at: string;
  overall_comment: string | null;
  borrower_comments: Record<string, string> | null;
  document_comments: Record<string, string> | null;
  invoice_submission_documents: {
    id: string;
    borrower_comment: string | null;
    document_type: string | null;
    ai_tag: string | null;
  }[];
}

interface Props {
  invoiceId: string;
  compact?: boolean;   // true = collapsed single-line summary
}

export function SubmissionCommentsTimeline({ invoiceId, compact = false }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoice_submissions")
        .select(`
          id, request_number, submitted_at, overall_comment,
          borrower_comments, document_comments,
          invoice_submission_documents (
            id, borrower_comment, document_type, ai_tag
          )
        `)
        .eq("invoice_id", invoiceId)
        .order("submitted_at", { ascending: false });
      setSubmissions((data as any) || []);
      setLoading(false);
    })();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading comments...
      </div>
    );
  }

  // Build flat list of all comment entries across all submissions
  const allComments: { label: string; text: string; date: string; reqNum: string | null }[] = [];

  for (const sub of submissions) {
    const date = sub.submitted_at;
    const req = sub.request_number;

    if (sub.overall_comment) {
      allComments.push({ label: "Overall Note", text: sub.overall_comment, date, reqNum: req });
    }
    if (sub.borrower_comments) {
      Object.entries(sub.borrower_comments).forEach(([key, val]) => {
        if (val) allComments.push({ label: `Observation ${key}`, text: val, date, reqNum: req });
      });
    }
    for (const doc of sub.invoice_submission_documents || []) {
      if (doc.borrower_comment) {
        const docLabel = doc.ai_tag || doc.document_type || "Document";
        allComments.push({
          label: docLabel.replace(/_/g, " "),
          text: doc.borrower_comment,
          date,
          reqNum: req,
        });
      }
    }
  }

  if (allComments.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <MessageSquare className="h-3.5 w-3.5" />
        No borrower comments on this invoice
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
        <span>{allComments.length} comment{allComments.length !== 1 ? "s" : ""} from borrower</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Borrower Comments</p>
        <Badge variant="secondary" className="text-[10px]">{allComments.length}</Badge>
      </div>

      <div className="relative pl-5 border-l-2 border-border space-y-4">
        {allComments.map((c, i) => (
          <div key={i} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full bg-primary/30 border-2 border-primary" />

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] gap-1 capitalize">
                  <FileText className="h-2.5 w-2.5" />
                  {c.label}
                </Badge>
                {c.reqNum && (
                  <Badge variant="secondary" className="text-[10px]">
                    Request #{c.reqNum}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(c.date), "dd MMM yyyy, HH:mm")}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{c.text}</p>
            </div>

            {i < allComments.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>
    </div>
  );
}
