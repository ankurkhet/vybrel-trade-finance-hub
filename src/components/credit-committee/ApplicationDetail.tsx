import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, RotateCcw, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Props {
  applicationId: string;
}

function CommitteeMembersCard({ votes, organizationId }: { votes: any[]; organizationId: string }) {
  const { data: members = [] } = useQuery({
    queryKey: ["cc-members-profiles", organizationId],
    queryFn: async () => {
      const { data: ccMembers } = await supabase
        .from("credit_committee_members")
        .select("user_id, is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true);
      if (!ccMembers || ccMembers.length === 0) return [];
      const userIds = ccMembers.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      return ccMembers.map((m: any) => {
        const p = profiles?.find((pr: any) => pr.user_id === m.user_id);
        const vote = votes.find((v: any) => v.user_id === m.user_id);
        return { ...m, full_name: p?.full_name || p?.email || "Unknown", vote };
      });
    },
    enabled: !!organizationId,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Committee Members</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active members configured.</p>
        ) : (
          members.map((m: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm rounded-lg border p-2">
              <span className="text-xs text-foreground truncate max-w-[150px]">{m.full_name}</span>
              {m.vote ? (
                <Badge
                  variant={m.vote.vote === "approve" ? "default" : m.vote.vote === "reject" ? "destructive" : "secondary"}
                  className="capitalize text-xs"
                >
                  {(m.vote.vote || "").replace(/_/g, " ")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Pending</Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ApplicationDetail({ applicationId }: Props) {
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isCommitteeMember = hasRole("credit_committee_member");
  const isOriginatorAdmin = hasRole("originator_admin");

  const [voteChoice, setVoteChoice] = useState("");
  const [voteNotes, setVoteNotes] = useState("");
  const [infoQuestion, setInfoQuestion] = useState("");
  const [infoAnswer, setInfoAnswer] = useState("");
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  const { data: application, isLoading } = useQuery({
    queryKey: ["cc-application", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_committee_applications")
        .select("*")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["cc-config", profile?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_committee_config")
        .select("*")
        .eq("organization_id", profile!.organization_id!)
        .maybeSingle();
      return data || { minimum_votes_required: 3, quorum_type: "fixed", total_active_members: 4 };
    },
    enabled: !!profile?.organization_id,
  });

  const { data: minutes } = useQuery({
    queryKey: ["cc-minutes", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_committee_minutes")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const { data: infoRequests = [] } = useQuery({
    queryKey: ["cc-info-requests", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_committee_info_requests")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["cc-app-history", applicationId],
    queryFn: async () => {
      if (!application?.parent_application_id && !application?.id) return [];
      // Find all linked applications
      const rootId = application?.parent_application_id || application?.id;
      const { data } = await supabase
        .from("credit_committee_applications")
        .select("id, application_number, status, decision, created_at")
        .or(`id.eq.${rootId},parent_application_id.eq.${rootId}`)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!application,
  });

  const votes: any[] = minutes?.votes ? (Array.isArray(minutes.votes) ? minutes.votes : []) : [];
  const approveCount = votes.filter((v: any) => v.vote === "approve" || v.vote === "approve_with_conditions").length;
  const rejectCount = votes.filter((v: any) => v.vote === "reject").length;
  const myVote = votes.find((v: any) => v.user_id === user?.id);

  const submitVoteMutation = useMutation({
    mutationFn: async () => {
      const newVote = { user_id: user!.id, vote: voteChoice, notes: voteNotes, voted_at: new Date().toISOString() };
      const updatedVotes = [...votes.filter((v: any) => v.user_id !== user!.id), newVote];

      if (minutes) {
        await supabase.from("credit_committee_minutes").update({
          votes: updatedVotes,
          attendees: [...new Set([...(minutes.attendees || []), user!.id])],
        }).eq("id", minutes.id);
      } else {
        await supabase.from("credit_committee_minutes").insert({
          application_id: applicationId,
          meeting_date: new Date().toISOString(),
          attendees: [user!.id],
          votes: updatedVotes,
        });
      }

      // Check quorum
      if (config) {
        const totalApprove = updatedVotes.filter((v: any) => v.vote === "approve" || v.vote === "approve_with_conditions").length;
        const totalReject = updatedVotes.filter((v: any) => v.vote === "reject").length;
        const needed = config.quorum_type === "majority"
          ? Math.ceil(config.total_active_members / 2)
          : config.minimum_votes_required;

        if (totalApprove >= needed) {
          await supabase.from("credit_committee_applications").update({
            status: "approved", decision: "approved", reviewed_at: new Date().toISOString(),
          }).eq("id", applicationId);

          // Assign proposed credit limit to borrower and update memo status
          const metadata = application?.metadata as any;
          if (metadata?.proposed_limit && application?.borrower_id) {
            await supabase.from("borrowers").update({
              credit_limit: metadata.proposed_limit,
            }).eq("id", application.borrower_id);
          }
          if (metadata?.credit_memo_id) {
            await supabase.from("credit_memos").update({
              status: "approved",
              approved_by: user!.id,
              approved_at: new Date().toISOString(),
            }).eq("id", metadata.credit_memo_id);
          }
        } else if (totalReject >= needed) {
          await supabase.from("credit_committee_applications").update({
            status: "rejected", decision: "rejected", reviewed_at: new Date().toISOString(),
          }).eq("id", applicationId);

          // Update memo status back to rejected
          const metadata = application?.metadata as any;
          if (metadata?.credit_memo_id) {
            await supabase.from("credit_memos").update({
              status: "rejected",
            }).eq("id", metadata.credit_memo_id);
          }
        } else if (voteChoice === "request_info") {
          await supabase.from("credit_committee_applications").update({ status: "pending_info" }).eq("id", applicationId);
        } else {
          await supabase.from("credit_committee_applications").update({ status: "under_review" }).eq("id", applicationId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Vote recorded");
      setVoteChoice("");
      setVoteNotes("");
      queryClient.invalidateQueries({ queryKey: ["cc-minutes", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["cc-application", applicationId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("credit_committee_applications").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }).eq("id", applicationId);
    },
    onSuccess: () => {
      toast.success("Application submitted for review");
      queryClient.invalidateQueries({ queryKey: ["cc-application", applicationId] });
    },
  });

  const reRaiseMutation = useMutation({
    mutationFn: async () => {
      const appNum = `CC-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("credit_committee_applications").insert({
        organization_id: application!.organization_id,
        type: application!.type,
        borrower_id: application!.borrower_id,
        debtor_name: application!.debtor_name,
        application_number: appNum,
        status: "reopened",
        created_by: user!.id,
        metadata: application!.metadata,
        parent_application_id: application!.id,
      });
    },
    onSuccess: () => {
      toast.success("Application re-raised for review");
      queryClient.invalidateQueries({ queryKey: ["cc-applications"] });
      navigate("/originator/credit-committee");
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("credit_committee_info_requests").insert({
        application_id: applicationId,
        requested_by: user!.id,
        requested_to: application!.created_by,
        question: infoQuestion,
      });
      await supabase.from("credit_committee_applications").update({ status: "pending_info" }).eq("id", applicationId);
    },
    onSuccess: () => {
      toast.success("Information request sent");
      setInfoQuestion("");
      setInfoDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cc-info-requests", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["cc-application", applicationId] });
    },
  });

  const answerInfoMutation = useMutation({
    mutationFn: async (reqId: string) => {
      await supabase.from("credit_committee_info_requests").update({
        answer: infoAnswer,
        status: "answered",
        answered_at: new Date().toISOString(),
      }).eq("id", reqId);
      // Check if all info requests are answered, if so move back to under_review
      const { data: openReqs } = await supabase
        .from("credit_committee_info_requests")
        .select("id")
        .eq("application_id", applicationId)
        .eq("status", "open");
      if (!openReqs || openReqs.length === 0) {
        await supabase.from("credit_committee_applications").update({ status: "under_review" }).eq("id", applicationId);
      }
    },
    onSuccess: () => {
      toast.success("Answer submitted");
      setInfoAnswer("");
      queryClient.invalidateQueries({ queryKey: ["cc-info-requests", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["cc-application", applicationId] });
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!application) return <p className="text-destructive">Application not found.</p>;

  const canVote = isCommitteeMember && ["submitted", "under_review", "reopened"].includes(application.status) && !myVote;
  const canSubmit = application.status === "draft" && application.created_by === user?.id;
  const canReRaise = ["approved", "rejected"].includes(application.status);
  const isCreator = application.created_by === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/originator/credit-committee")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{application.application_number}</h2>
          <p className="text-sm text-muted-foreground capitalize">{(application.type || "").replace(/_/g, " ")} — {application.debtor_name || "N/A"}</p>
        </div>
        <Badge variant={application.status === "approved" ? "default" : application.status === "rejected" ? "destructive" : "secondary"}>
          {application.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{(application.type || "").replace(/_/g, " ")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Debtor</span><span>{application.debtor_name || "—"}</span></div>
              {(application.metadata as any)?.proposed_limit && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proposed Credit Limit</span>
                  <span className="font-bold text-foreground">£{Number((application.metadata as any).proposed_limit).toLocaleString()}</span>
                </div>
              )}
              {(application.metadata as any)?.risk_rating && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk Rating</span>
                  <Badge variant="secondary" className="capitalize">{(application.metadata as any).risk_rating}</Badge>
                </div>
              )}
              {(application.metadata as any)?.memo_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memo #</span>
                  <span className="font-mono text-xs">{(application.metadata as any).memo_number}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(application.created_at).toLocaleDateString()}</span></div>
              {application.submitted_at && <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span>{new Date(application.submitted_at).toLocaleDateString()}</span></div>}
              {application.decision_notes && (
                <>
                  <Separator />
                  <p className="text-muted-foreground">{application.decision_notes}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Voting */}
          {canVote && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Cast Your Vote</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {["approve", "approve_with_conditions", "reject"].map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={voteChoice === v ? "default" : "outline"}
                      onClick={() => setVoteChoice(v)}
                      className="capitalize"
                    >
                      {v.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>
                <Textarea placeholder="Notes (optional)" value={voteNotes} onChange={(e) => setVoteNotes(e.target.value)} />
                <Button
                  disabled={!voteChoice || submitVoteMutation.isPending}
                  onClick={() => submitVoteMutation.mutate()}
                >
                  <Send className="mr-1 h-4 w-4" /> Submit Vote
                </Button>
              </CardContent>
            </Card>
          )}

          {myVote && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  You voted: <span className="font-medium capitalize text-foreground">{myVote.vote.replace(/_/g, " ")}</span>
                  {myVote.notes && ` — "${myVote.notes}"`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Info Requests */}
          {infoRequests.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Information Requests</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {infoRequests.map((req: any) => (
                  <div key={req.id} className="rounded-lg border p-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">Q: {req.question}</p>
                    {req.answer ? (
                      <p className="text-sm text-muted-foreground">A: {req.answer}</p>
                    ) : isCreator ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type your answer..."
                          value={infoAnswer}
                          onChange={(e) => setInfoAnswer(e.target.value)}
                        />
                        <Button size="sm" disabled={!infoAnswer} onClick={() => answerInfoMutation.mutate(req.id)}>
                          Answer
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary">Awaiting answer</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Decision History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{h.application_number}</span>
                      <Badge variant={h.status === "approved" ? "default" : h.status === "rejected" ? "destructive" : "secondary"}>
                        {h.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Quorum Status</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Required</span>
                <span className="font-medium">{config?.minimum_votes_required || 3} votes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approve</span>
                <span className="font-medium text-emerald-600">{approveCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reject</span>
                <span className="font-medium text-destructive">{rejectCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Votes</span>
                <span className="font-medium">{votes.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Committee Members & Votes */}
          <CommitteeMembersCard votes={votes} organizationId={application.organization_id} />

          <div className="space-y-2">
            {canSubmit && (
              <Button className="w-full" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                <Send className="mr-1 h-4 w-4" /> Submit for Review
              </Button>
            )}

            {canReRaise && (
              <Button variant="outline" className="w-full" onClick={() => reRaiseMutation.mutate()} disabled={reRaiseMutation.isPending}>
                <RotateCcw className="mr-1 h-4 w-4" /> Re-raise for Review
              </Button>
            )}

            {isCommitteeMember && ["submitted", "under_review", "reopened"].includes(application.status) && (
              <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <MessageSquare className="mr-1 h-4 w-4" /> Request Information
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Request Additional Information</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Textarea value={infoQuestion} onChange={(e) => setInfoQuestion(e.target.value)} placeholder="What information do you need?" />
                    </div>
                    <Button className="w-full" disabled={!infoQuestion || requestInfoMutation.isPending} onClick={() => requestInfoMutation.mutate()}>
                      Send Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
