import { toast } from "@/components/ui/toast";
import { execute } from "@/lib/action-handler";
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAction<TArgs, TResult>(
  actionFn: (args: TArgs) => Promise<TResult>,
  options: {
    onSuccess?: (data: TResult) => void;
    invalidate?: (string | string[] | QueryKey)[];
    successMsg?: string;
    errorMsg?: string;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: TArgs) => execute(actionFn(args)),
    onSuccess: async (data) => {
      if (options.invalidate) {
        await Promise.all(
          options.invalidate.map((key) => queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }))
        );
      }
      if (options.successMsg) toast.success(options.successMsg);
      options.onSuccess?.(data);
    },
    onError: (err: any) => toast.error(err.message || "An error occurred"),
  });
}
