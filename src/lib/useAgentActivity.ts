"use client";

import { useCallback, useState } from "react";
import type {
  ActivityEvent,
  ActivityStep,
  ActivityStatus,
} from "@/components/agent/AgentActivityPanel";

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useAgentActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const start = useCallback(
    (step: ActivityStep, detail?: string): string => {
      const id = newId();
      setEvents((prev) => [
        ...prev,
        { id, step, status: "active", startedAt: Date.now(), detail },
      ]);
      return id;
    },
    []
  );

  const finish = useCallback(
    (
      id: string,
      patch: Partial<Omit<ActivityEvent, "id" | "step">> & { status: ActivityStatus }
    ) => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, ...patch, endedAt: Date.now() }
            : e
        )
      );
    },
    []
  );

  const log = useCallback(
    (step: ActivityStep, patch: Partial<Omit<ActivityEvent, "id" | "step" | "status">>) => {
      setEvents((prev) => [
        ...prev,
        {
          id: newId(),
          step,
          status: "done",
          startedAt: Date.now(),
          endedAt: Date.now(),
          ...patch,
        },
      ]);
    },
    []
  );

  const clear = useCallback(() => setEvents([]), []);

  return { events, start, finish, log, clear };
}
