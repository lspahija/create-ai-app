import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
  });
}

export function useSetOAuthToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.setOAuthToken(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useClearOAuthToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearOAuthToken(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
