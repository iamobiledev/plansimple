import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export type FeatureFlags = Record<string, boolean>;

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => apiFetch<FeatureFlags>("/feature-flags"),
    staleTime: 60_000,
  });
}

export function FeatureFlagGate({
  flag,
  children,
  fallback = null,
}: {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { data } = useFeatureFlags();
  if (!data?.[flag]) return <>{fallback}</>;
  return <>{children}</>;
}
