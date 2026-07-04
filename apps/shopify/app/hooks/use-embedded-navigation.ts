import { useCallback } from "react";
import { useLocation, useNavigate } from "@remix-run/react";

export function useEmbeddedPath(path: string) {
  const { search } = useLocation();
  return `${path}${search}`;
}

export function useEmbeddedNavigate() {
  const navigate = useNavigate();
  const { search } = useLocation();

  return useCallback((path: string) => navigate(`${path}${search}`), [navigate, search]);
}
