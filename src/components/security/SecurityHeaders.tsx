import { useEffect } from "react";

/**
 * SecurityHeaders component adds CSP and security-related meta tags.
 * In production, these should be set as HTTP headers via the server/CDN.
 * This component provides client-side fallbacks.
 */
export function SecurityHeaders() {
  useEffect(() => {
    // Set CSP meta tag
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!existingCSP) {
      const meta = document.createElement("meta");
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovableproject.com",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
      ].join("; ");
      document.head.appendChild(meta);
    }

    // X-Content-Type-Options equivalent
    const xContentType = document.querySelector('meta[http-equiv="X-Content-Type-Options"]');
    if (!xContentType) {
      const meta = document.createElement("meta");
      meta.httpEquiv = "X-Content-Type-Options";
      meta.content = "nosniff";
      document.head.appendChild(meta);
    }

    // Referrer Policy
    const referrerMeta = document.querySelector('meta[name="referrer"]');
    if (!referrerMeta) {
      const meta = document.createElement("meta");
      meta.name = "referrer";
      meta.content = "strict-origin-when-cross-origin";
      document.head.appendChild(meta);
    }
  }, []);

  return null;
}
