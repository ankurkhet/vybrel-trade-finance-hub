import * as React from "react";

const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(false);

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isTablet;
}

export function useBreakpoint() {
  const [bp, setBp] = React.useState<"mobile" | "tablet" | "desktop">("desktop");

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < MOBILE_BREAKPOINT) setBp("mobile");
      else if (w < TABLET_BREAKPOINT) setBp("tablet");
      else setBp("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return bp;
}
