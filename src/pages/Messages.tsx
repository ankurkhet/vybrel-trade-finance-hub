import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Inbox, ArrowUpRight, MessageSquare, Loader2, CheckCheck, Clock, Reply, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  message_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  parent_message_id: string | null;
  is_read: boolean;
  created_at: string;
  organization_id: string | null;
}

export default function Messages() {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  // Subscribe to realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.recipient_id === user.id) {
          setInbox(prev => [msg, ...prev]);
        }
        if (msg.sender_id === user.id) {
          setSent(prev => [msg, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchMessages = async () => {
    setLoading(true);
    const [inboxRes, sentRes] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("messages")
        .select("*")
        .eq("sender_id", user!.id)
        .order("created_at", { ascending: false }),
    ]);

    const inboxData = (inboxRes.data || []) as Message[];
    const sentData = (sentRes.data || []) as Message[];
    setInbox(inboxData);
    setSent(sentData);

    // Fetch sender names
    const allUserIds = [...new Set([
      ...inboxData.map(m => m.sender_id),
      ...sentData.map(m => m.recipient_id),
    ])];
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", allUserIds);
      const names: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        names[p.user_id] = p.full_name || p.email || "Unknown";
      });
      setSenderNames(names);
    }

    setLoading(false);
  };

  const markAsRead = async (msg: Message) => {
    if (!msg.is_read) {
      await supabase.from("messages").update({ is_read: true }).eq("id", msg.id);
      setInbox(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
    setSelectedMessage(msg);
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyBody.trim() || !user) return;
    setReplying(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: selectedMessage.sender_id,
      subject: `Re: ${selectedMessage.subject}`,
      body: replyBody,
      message_type: "reply",
      parent_message_id: selectedMessage.id,
      organization_id: selectedMessage.organization_id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Reply sent");
      setReplyBody("");
      fetchMessages();
    }
    setReplying(false);
  };

  const handleCompose = async () => {
    if (!newSubject.trim() || !newBody.trim() || !newRecipientEmail.trim() || !user) return;
    setSending(true);

    // Look up recipient by email
    const { data: recipientProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", newRecipientEmail.trim())
      .limit(1);

    if (!recipientProfiles || recipientProfiles.length === 0) {
      toast.error("Recipient not found. Check the email address.");
      setSending(false);
      return;
    }

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: recipientProfiles[0].user_id,
      subject: newSubject,
      body: newBody,
      message_type: "general",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Message sent");
      setNewSubject("");
      setNewBody("");
      setNewRecipientEmail("");
      setComposeOpen(false);
      fetchMessages();
    }
    setSending(false);
  };

  const unreadCount = inbox.filter(m => !m.is_read).length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return `${Math.floor(diffMs / (1000 * 60))}m ago`;
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    return d.toLocaleDateString();
  };

  const messageTypeLabel = (type: string) => {
    switch (type) {
      case "info_request": return "Info Request";
      case "correction_request": return "Correction";
      case "document_rejection": return "Doc Rejected";
      case "document_approved": return "Doc Approved";
      case "reply": return "Reply";
      default: return "Message";
    }
  };

  const messageTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "document_rejection":
      case "correction_request":
        return "destructive";
      case "document_approved":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Messages</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Message
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message List */}
          <div className="lg:col-span-1">
            <Tabs defaultValue="inbox">
              <TabsList className="w-full">
                <TabsTrigger value="inbox" className="flex-1">
                  <Inbox className="mr-1.5 h-3.5 w-3.5" />
                  Inbox {unreadCount > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{unreadCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="sent" className="flex-1">
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Sent
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inbox" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    {loading ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : inbox.length === 0 ? (
                      <div className="flex flex-col items-center py-12">
                        <Mail className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[60vh]">
                        {inbox.map((msg) => (
                          <button
                            key={msg.id}
                            onClick={() => markAsRead(msg)}
                            className={`w-full text-left p-4 border-b last:border-b-0 transition-colors hover:bg-muted/50 ${
                              selectedMessage?.id === msg.id ? "bg-muted/70" : ""
                            } ${!msg.is_read ? "bg-primary/5" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {!msg.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                                  <p className={`text-sm truncate ${!msg.is_read ? "font-semibold" : "font-medium"}`}>
                                    {senderNames[msg.sender_id] || "Unknown"}
                                  </p>
                                </div>
                                <p className="text-sm text-foreground truncate mt-0.5">{msg.subject}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.body.slice(0, 80)}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-[10px] text-muted-foreground">{formatDate(msg.created_at)}</span>
                                <Badge variant={messageTypeBadgeVariant(msg.message_type)} className="text-[10px]">
                                  {messageTypeLabel(msg.message_type)}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sent" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    {loading ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : sent.length === 0 ? (
                      <div className="flex flex-col items-center py-12">
                        <Send className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">No sent messages</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[60vh]">
                        {sent.map((msg) => (
                          <button
                            key={msg.id}
                            onClick={() => setSelectedMessage(msg)}
                            className={`w-full text-left p-4 border-b last:border-b-0 transition-colors hover:bg-muted/50 ${
                              selectedMessage?.id === msg.id ? "bg-muted/70" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">To: {senderNames[msg.recipient_id] || "Unknown"}</p>
                                <p className="text-sm text-foreground truncate mt-0.5">{msg.subject}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.body.slice(0, 80)}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(msg.created_at)}</span>
                            </div>
                          </button>
                        ))}
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              {selectedMessage ? (
                <>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                        <CardDescription className="mt-1">
                          {selectedMessage.sender_id === user?.id ? "To" : "From"}:{" "}
                          {senderNames[selectedMessage.sender_id === user?.id ? selectedMessage.recipient_id : selectedMessage.sender_id] || "Unknown"}
                          {" · "}
                          {new Date(selectedMessage.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                      <Badge variant={messageTypeBadgeVariant(selectedMessage.message_type)}>
                        {messageTypeLabel(selectedMessage.message_type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm whitespace-pre-wrap">{selectedMessage.body}</p>
                    </div>

                    {selectedMessage.sender_id !== user?.id && (
                      <div className="space-y-3">
                        <Separator />
                        <Label className="text-xs font-medium">Reply</Label>
                        <Textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Type your reply..."
                          rows={4}
                        />
                        <Button onClick={handleReply} disabled={replying || !replyBody.trim()} size="sm">
                          {replying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Reply className="mr-2 h-3.5 w-3.5" />}
                          Send Reply
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex flex-col items-center justify-center py-24">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">Select a message to view</p>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient Email</Label>
              <Input
                type="email"
                placeholder="recipient@company.com"
                value={newRecipientEmail}
                onChange={(e) => setNewRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                placeholder="Message subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                placeholder="Write your message..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleCompose} disabled={sending || !newSubject.trim() || !newBody.trim() || !newRecipientEmail.trim()}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
