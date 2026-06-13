import * as React from "react";

import { cn } from "../../lib/utils";

export interface CheckListProps {
  items: React.ReactNode[];
  className?: string;
}

export function CheckList({ items, className }: CheckListProps) {
  return (
    <ul className={cn("text-muted-foreground/90 space-y-1 text-left text-xs sm:text-sm", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-2.5">
          <span className="text-lg text-[#00c48c]">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
