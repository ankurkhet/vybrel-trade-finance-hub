import { useState, useEffect } from "react";
import { Bell, Check, Loader2, Info, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  action_url?: string;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data as any[] as AppNotification[]);
      }
      setLoading(false);
    };

    fetchNotifications();

    // Setup realtime subscription for new notifications
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev].slice(0, 20));
          toast.info("New notification: " + payload.new.title);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
      
    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    const { error } = await supabase
      .from("notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .is("read_at", null);
      
    if (!error) {
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    setOpen(false);
    if (notification.action_url) {
      if (notification.action_url.startsWith("http")) {
        window.open(notification.action_url, "_blank");
      } else {
        navigate(notification.action_url);
      }
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500 mt-0.5" />;
      default: return <Info className="h-4 w-4 text-blue-500 mt-0.5" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));
    const diffHours = Math.round(diff / (1000 * 60 * 60));
    const diffMins = Math.round(diff / (1000 * 60));
    
    if (Math.abs(diffDays) > 0) return rtf.format(diffDays, 'day');
    if (Math.abs(diffHours) > 0) return rtf.format(diffHours, 'hour');
    return rtf.format(diffMins, 'minute');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative mr-2 h-9 w-9 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -right-1 -top-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full border-2 border-background"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[380px] p-0 border-border/40 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-muted/20">
          <DropdownMenuLabel className="p-0 font-semibold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && <Badge className="text-[10px] bg-primary/20 text-primary hover:bg-primary/20 h-5 px-1.5">{unreadCount} new</Badge>}
          </DropdownMenuLabel>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
            disabled={unreadCount === 0}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground/70">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">We'll let you know when something important happens.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0 ${!n.read_at ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex-shrink-0">
                    {getIconForType(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`text-sm tracking-tight leading-snug ${!n.read_at ? 'font-semibold' : 'font-medium'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                      {formatTimeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read_at && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
