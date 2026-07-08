"use client";

import * as React from "react";

import { getCurrentOrganization } from "@/actions/organization";
import { ApiListParams, PaginatedResult } from "@/types";
import { type QueryKey, type UseQueryOptions, keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_PAGE_SIZE = 10;

type OrgQueryKey = [string, ...any[]];

type Pagination = true | { pageSize?: number };

export function useOrgContext() {
  return useQuery({
    queryKey: ["org-context"],
    queryFn: () => getCurrentOrganization(),
    staleTime: Infinity,
    retry: 1,
  });
}

// Type utility to handle the three states:
// 1. Paginated & Not Transformed -> return U[]
// 2. Paginated & Transformed -> return TTransformed
// 3. Not Paginated -> return TData
type ResolvedData<TQueryFnData, TTransformed, TPag> = TPag extends Pagination
  ? TQueryFnData extends TTransformed // This checks if TTransformed is the default (i.e., no select used)
    ? TQueryFnData extends PaginatedResult<infer U>
      ? U[]
      : TTransformed
    : TTransformed
  : TTransformed;

export function useOrgQuery<
  TQueryFnData,
  TError = Error,
  TTransformed = TQueryFnData, // This is the output of the select function
  const TPag extends Pagination | undefined = undefined,
>(
  baseQueryKey: OrgQueryKey,
  queryFn: (params?: ApiListParams) => Promise<TQueryFnData>,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TTransformed>, "queryKey" | "queryFn"> & { pagination?: TPag }
) {
  const { pagination, ...queryOptions } = options ?? {};
  const { data: org, isLoading: contextLoading } = useOrgContext();
  const [pageIndex, setPageIndex] = React.useState(0);
  const pageSize = typeof pagination === "object" ? (pagination.pageSize ?? DEFAULT_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

  const listParams = React.useMemo(
    () => ({
      limit: pageSize,
      ...(pageIndex > 0 ? { starting_after: String(pageIndex * pageSize) } : {}),
    }),
    [pageIndex, pageSize]
  );

  const queryKey: QueryKey = [
    ...baseQueryKey,
    ...(pagination ? [pageIndex, pageSize] : []),
    org?.id,
    org?.environment,
  ].filter(Boolean);

  const result = useQuery({
    ...queryOptions,
    queryKey,
    queryFn: () => queryFn(pagination ? listParams : undefined),
    enabled: !contextLoading && !!org?.id && (queryOptions.enabled ?? true),
    placeholderData: pagination ? keepPreviousData : queryOptions.placeholderData,
  });

  const data = (
    pagination && !options?.select ? (result.data as PaginatedResult<any> | undefined)?.data : result.data
  ) as ResolvedData<TQueryFnData, TTransformed, TPag> | undefined;

  return {
    ...result,
    data,
    pageIndex,
    pageSize,
    setPageIndex,
    hasNextPage: pagination ? !!(result.data as PaginatedResult<any> | undefined)?.has_more : false,
    hasPreviousPage: pagination ? pageIndex > 0 : false,
    isLoading: contextLoading || result.isLoading,
    isPending: contextLoading || result.isPending,
  };
}

export function useInvalidateOrgQuery() {
  const queryClient = useQueryClient();
  const { data: org } = useOrgContext();

  return (baseQueryKey: OrgQueryKey) =>
    queryClient.invalidateQueries({
      queryKey: [...baseQueryKey, org?.id, org?.environment].filter(Boolean),
    });
}
