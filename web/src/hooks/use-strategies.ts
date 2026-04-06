import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { StrategyCreateRequest, StrategyUpdateRequest } from "@/api/types";

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: api.strategies,
  });
}

export function useStrategy(name: string | undefined) {
  return useQuery({
    queryKey: ["strategies", name],
    queryFn: () => api.strategy(name!),
    enabled: !!name,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StrategyCreateRequest) => api.createStrategy(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: StrategyUpdateRequest }) =>
      api.updateStrategy(name, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteStrategy(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}
