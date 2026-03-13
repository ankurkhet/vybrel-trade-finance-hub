import { useEffect, useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle
const WARNING_BEFORE_MS = 2 * 60 * 1000;   // Show warning 2 min before

interface SessionManagerProps {
  onSessionExpired: () => void;
  enabled?: boolean;
}

export function SessionManager({ onSessionExpired, enabled = true }: SessionManagerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const resetTimers = useCallback(() => {
    if (!enabled) return;

    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    clearInterval(countdownRef.current);
    setShowWarning(false);

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.floor(WARNING_BEFORE_MS / 1000));
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutRef.current = setTimeout(() => {
      setShowWarning(false);
      onSessionExpired();
    }, SESSION_TIMEOUT_MS);
  }, [enabled, onSessionExpired]);

  useEffect(() => {
    if (!enabled) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    const handler = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(timeoutRef.current);
      clearTimeout(warningRef.current);
      clearInterval(countdownRef.current);
    };
  }, [enabled, resetTimers]);

  const handleExtend = () => {
    resetTimers();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <DialogTitle className="text-center">Session Expiring</DialogTitle>
          <DialogDescription className="text-center">
            Your session will expire in{" "}
            <span className="font-mono font-bold text-foreground">{formatTime(countdown)}</span>{" "}
            due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onSessionExpired}>
            Log Out
          </Button>
          <Button className="flex-1" onClick={handleExtend}>
            Stay Logged In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
