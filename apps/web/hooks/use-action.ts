import { execute } from "@/lib/action-handler";
import { toast } from "@stellartools/shared-ui";
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAction<TArgs, TResult>(
  actionFn: (args: TArgs) => Promise<TResult>,
  options: {
    onSuccess?: (data: TResult, args: TArgs) => void;
    onError?: (error: Error) => void;
    invalidate?: (string | string[] | QueryKey)[];
    successMsg?: string | ((data: TResult, args: TArgs) => string);
    errorMsg?: string;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: TArgs) => execute(actionFn(args)),
    onSuccess: async (data, variables) => {
      if (options.invalidate) {
        await Promise.all(
          options.invalidate.map((key) =>
            key === "*"
              ? queryClient.invalidateQueries()
              : queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
          )
        );
      }
      if (options.successMsg)
        toast.success(
          typeof options.successMsg === "function" ? options.successMsg(data, variables) : options.successMsg
        );
      options.onSuccess?.(data, variables);
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred");
      options.onError?.(err);
    },
  });
}
