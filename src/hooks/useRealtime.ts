import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** One shared realtime channel: any change in the farm database refreshes cached data on every device. */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("farm-sync")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          queryClient.invalidateQueries();
        }, 250);
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return connected;
}
