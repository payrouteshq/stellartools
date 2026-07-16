import * as React from "react";

import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { PaginatedResult } from "@/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/organization", () => ({
  getCurrentOrganization: vi.fn(async () => ({
    id: "org_1",
    environment: "testnet",
    selectedCurrency: "USD",
  })),
}));

const paginated = <T,>(data: T[], has_more: boolean): PaginatedResult<T> => ({ data, has_more });

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useOrgQuery (non-paginated)", () => {
  it("waits for the org context, then passes no list params", async () => {
    const { wrapper } = createWrapper();
    const queryFn = vi.fn(async () => ({ hello: "world" }));

    const { result } = renderHook(() => useOrgQuery(["thing"], queryFn), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual({ hello: "world" });
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPreviousPage).toBe(false);
  });
});

describe("useOrgQuery (paginated)", () => {
  it("requests the first page without starting_after and unwraps the data array", async () => {
    const { wrapper } = createWrapper();
    const queryFn = vi.fn(async () => paginated([{ id: "a" }, { id: "b" }], true));

    const { result } = renderHook(() => useOrgQuery(["subs"], queryFn, { pagination: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledWith({ limit: 10 });
    expect(result.current.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it("passes an offset cursor for subsequent pages", async () => {
    const { wrapper } = createWrapper();
    const queryFn = vi.fn(async () => paginated([{ id: "c" }], false));

    const { result } = renderHook(() => useOrgQuery(["subs"], queryFn, { pagination: true }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPageIndex(1));

    await waitFor(() => expect(queryFn).toHaveBeenCalledWith({ limit: 10, starting_after: "10" }));
    await waitFor(() => expect(result.current.hasPreviousPage).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("respects a custom page size", async () => {
    const { wrapper } = createWrapper();
    const queryFn = vi.fn(async () => paginated([], false));

    const { result } = renderHook(() => useOrgQuery(["subs"], queryFn, { pagination: { pageSize: 100 } }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledWith({ limit: 100 });

    act(() => result.current.setPageIndex(2));
    await waitFor(() => expect(queryFn).toHaveBeenCalledWith({ limit: 100, starting_after: "200" }));
  });

  it("keeps page 0 and page 1 in separate cache entries", async () => {
    const { wrapper, queryClient } = createWrapper();
    const queryFn = vi.fn(async () => paginated([{ id: "x" }], true));

    const { result } = renderHook(() => useOrgQuery(["subs"], queryFn, { pagination: true }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPageIndex(1));
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

    // only org-scoped keys matter; a disabled placeholder entry exists from
    // before the org context resolved
    const cachedKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .filter((k) => k[0] === "subs" && k[1] === "org_1");
    expect(cachedKeys).toHaveLength(2);
    // page index 0 must not be dropped from the key
    expect(cachedKeys).toContainEqual(["subs", "org_1", "testnet", 0, 10]);
    expect(cachedKeys).toContainEqual(["subs", "org_1", "testnet", 1, 10]);
  });
});

describe("useInvalidateOrgQuery", () => {
  it("invalidates paginated org queries (regression: pagination segments used to break prefix matching)", async () => {
    const { wrapper } = createWrapper();
    const queryFn = vi.fn(async () => paginated([{ id: "a" }], false));

    const { result } = renderHook(
      () => ({
        query: useOrgQuery(["subs"], queryFn, { pagination: true }),
        invalidate: useInvalidateOrgQuery(),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.query.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.invalidate(["subs"]);
    });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it("invalidates non-paginated org queries too", async () => {
    const { wrapper } = createWrapper();
    const queryFn = vi.fn(async () => ({ n: 1 }));

    const { result } = renderHook(
      () => ({
        query: useOrgQuery(["settings"], queryFn),
        invalidate: useInvalidateOrgQuery(),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.query.isLoading).toBe(false));

    await act(async () => {
      await result.current.invalidate(["settings"]);
    });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });
});
