import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { branchesApi, schedulingApi } from '../api/client';
import type { Branch, Position } from '../types/api';
import { fullDayRange } from '../utils/time';

function findBranchForJobSite(branches: Branch[], jobSite: string | undefined): Branch | null {
  if (!jobSite) return null;
  const needle = jobSite.trim().toLowerCase();
  return branches.find((b) => b.name.trim().toLowerCase() === needle) ?? null;
}

export interface TodayShiftContext {
  branch: Branch | null;
  position: Position | null;
  startTime: Date | null;
}

// Resolves "the shift that matters right now" for the caller: whichever of today's approved
// shifts is currently underway, or failing that, the next one still to come today. Shared by
// Home (the "today's shift" banner) and Time Clock (the geofence map + subtitle) so the two
// screens never disagree about which shift is relevant. Reloads whenever the screen holding it
// regains focus (not just on first mount) and every 5 minutes while it stays focused, so it
// stays correct as shifts start/end and as the "starts in 3 hours" window opens.
export function useTodayShiftContext(): TodayShiftContext {
  const { authFetch } = useAuth();
  const [context, setContext] = useState<TodayShiftContext>({
    branch: null,
    position: null,
    startTime: null,
  });

  const load = useCallback(async () => {
    try {
      const [shifts, branches] = await Promise.all([
        authFetch((token) => schedulingApi.myShifts(token, fullDayRange())),
        authFetch((token) => branchesApi.list(token)),
      ]);
      const approved = shifts.filter((s) => s.approval === 'approved' && s.jobSite);
      const now = Date.now();
      const current = approved.find(
        (s) => new Date(s.startTime).getTime() <= now && now <= new Date(s.endTime).getTime(),
      );
      const next = approved
        .filter((s) => new Date(s.startTime).getTime() > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
      const relevant = current ?? next;
      setContext({
        branch: findBranchForJobSite(branches, relevant?.jobSite),
        position: relevant?.position ?? null,
        startTime: relevant ? new Date(relevant.startTime) : null,
      });
    } catch {
      setContext({ branch: null, position: null, startTime: null });
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 5 * 60 * 1000);
      return () => clearInterval(id);
    }, [load]),
  );

  return context;
}
