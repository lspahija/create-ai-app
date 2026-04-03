import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: api.jobs,
    staleTime: 1_000,
    refetchInterval: 3_000,
  });
}
