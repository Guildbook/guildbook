"use client";

import { useEffect, useRef } from "react";
import { toast, type ToastKind } from "@/lib/toast";

/**
 * Toasts an outcome carried in a query parameter, then drops the parameter so a reload doesn't repeat it. For
 * round trips a flash cookie can't make, such as Battle.net OAuth, which returns from the apex to another host.
 */
export function StatusToast({ param, kind, message }: { param: string; kind: ToastKind; message: string }) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast(message, kind);
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url);
  }, [param, kind, message]);

  return null;
}
