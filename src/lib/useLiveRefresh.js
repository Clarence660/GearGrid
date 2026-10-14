import { useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

// Calls onChange (debounced) whenever rows change in any of the given tables,
// and when the browser tab becomes visible again. Row-level security still applies,
// so a user only hears about rows they are allowed to read.
export default function useLiveRefresh(tables, onChange, enabled = true) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;
  const key = tables.join(",");

  useEffect(() => {
    if (!enabled) return undefined;

    let timer;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current?.(), 700);
    };

    let channel = supabase.channel(`live-${key}-${Math.random().toString(36).slice(2)}`);
    tables.forEach((table) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, fire);
    });
    channel.subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}