import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, Search, MessageSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contact {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  unread: number;
  lastMessage?: string;
  lastAt?: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  thread_id: string;
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function Messages() {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load allowed contacts (within tenancy hierarchy)
  useEffect(() => {
    if (user && profile) loadContacts();
  }, [user, profile]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-rt-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.recipient_id === user.id || msg.sender_id === user.id) {
          setThread((prev) => {
            if (selectedContact && (msg.sender_id === selectedContact.user_id || msg.recipient_id === selectedContact.user_id)) {
              return [...prev, msg];
            }
            return prev;
          });
          // Update last message in contacts list
          setContacts((prev) =>
            prev.map((c) => {
              if (c.user_id === msg.sender_id || c.user_id === msg.recipient_id) {
                return {
                  ...c,
                  lastMessage: msg.body.slice(0, 60),
                  lastAt: msg.created_at,
                  unread: msg.recipient_id === user.id && msg.sender_id === c.user_id ? c.unread + 1 : c.unread,
                };
              }
              return c;
            })
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedContact]);

  // Scroll to bottom when thread loads or new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // Pull all users in the same organization. Admins see everyone.
      const { data: peers } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("organization_id", profile!.organization_id!)
        .neq("id", user!.id);

      // Also include Vybrel platform admins for cross-tenancy support
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", (
          await supabase.from("user_roles").select("user_id").eq("role", "vybrel_admin")
        ).data?.map((r: any) => r.user_id) || []);

      const allContacts: any[] = [
        ...(peers || []),
        ...(adminProfiles || []).filter((a: any) => a.id !== user!.id && !(peers || []).find((p: any) => p.id === a.id)),
      ];

      // Fetch recent messages to get last message & unread counts
      const { data: recentMsgs } = await supabase
        .from("messages" as any)
        .select("sender_id, recipient_id, body, is_read, created_at")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(200);

      const contactList: Contact[] = allContacts.map((peer: any) => {
        const peerMsgs = (recentMsgs || []).filter(
          (m: any) => m.sender_id === peer.user_id || m.recipient_id === peer.user_id
        );
        const last = peerMsgs[0];
        const unread = peerMsgs.filter((m: any) => m.recipient_id === user!.id && !m.is_read && m.sender_id === peer.user_id).length;
        return {
          user_id: peer.user_id,
          full_name: peer.full_name || peer.email,
          email: peer.email,
          role: "",
          unread,
          lastMessage: last?.body?.slice(0, 60),
          lastAt: last?.created_at,
        };
      });

      // Sort: contacts with messages first (by most recent), then alphabetically
      contactList.sort((a, b) => {
        if (a.lastAt && b.lastAt) return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
        if (a.lastAt) return -1;
        if (b.lastAt) return 1;
        return (a.full_name || "").localeCompare(b.full_name || "");
      });

      setContacts(contactList);
    } catch (e: any) {
      toast.error("Failed to load contacts: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (contact: Contact) => {
    setSelectedContact(contact);
    setThread([]);
    const { data } = await supabase
      .from("messages" as any)
      .select("*")
      .or(
        `and(sender_id.eq.${user!.id},recipient_id.eq.${contact.user_id}),and(sender_id.eq.${contact.user_id},recipient_id.eq.${user!.id})`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    setThread((data as ChatMessage[]) || []);

    // Mark all as read
    await supabase
      .from("messages" as any)
      .update({ is_read: true })
      .eq("recipient_id", user!.id)
      .eq("sender_id", contact.user_id);
    setContacts((prev) => prev.map((c) => c.user_id === contact.user_id ? { ...c, unread: 0 } : c));
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedContact || sending) return;
    setSending(true);
    const body = input.trim();
    setInput("");

    const payload = {
      organization_id: profile!.organization_id,
      thread_id: [user!.id, selectedContact.user_id].sort().join("-"),
      sender_id: user!.id,
      recipient_id: selectedContact.user_id,
      body,
      is_read: false,
      email_sent: false,
    };

    const { data, error } = await supabase.from("messages" as any).insert(payload).select().single();
    if (error) {
      toast.error("Failed to send message: " + error.message);
      setInput(body);
    } else {
      setThread((prev) => [...prev, data as ChatMessage]);
      // Trigger email notification via edge function (best-effort)
      supabase.functions.invoke("send-message-email", {
        body: { recipient_id: selectedContact.user_id, sender_name: profile?.full_name || "A user", preview: body.slice(0, 100) }
      }).catch(() => {}); // non-blocking
    }
    setSending(false);
  };

  const filteredContacts = contacts.filter((c) =>
    (c.full_name + c.email).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex rounded-xl border bg-background shadow-sm overflow-hidden">
        {/* ── Left panel: Contacts sidebar ──────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-base">Messages</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          {/* Contact list */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">
                <Users className="h-8 w-8 mb-3 opacity-30" />
                <p>No contacts found</p>
              </div>
            ) : (
              filteredContacts.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => loadThread(c)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50",
                    selectedContact?.user_id === c.user_id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initials(c.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-medium truncate", c.unread > 0 && "font-bold")}>{c.full_name}</span>
                      {c.lastAt && <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">{formatTime(c.lastAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{c.lastMessage || c.email}</p>
                      {c.unread > 0 && (
                        <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px] bg-primary ml-1 flex-shrink-0">{c.unread}</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* ── Right panel: Thread ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Thread header */}
              <div className="p-4 border-b flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initials(selectedContact.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{selectedContact.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedContact.email}</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {thread.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-12">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p>No messages yet. Say hi!</p>
                    </div>
                  )}
                  {thread.map((msg) => {
                    const isMe = msg.sender_id === user!.id;
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm border"
                        )}>
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              {/* Input bar */}
              <div className="p-4 border-t flex gap-2 items-end">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message ${selectedContact.full_name}...`}
                  className="flex-1 text-sm"
                  disabled={sending}
                />
                <Button size="icon" onClick={sendMessage} disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a contact from the left to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
