import React from "react";

const stats = [
  {
    value: "3–5s",
    label: "Settlement time",
  },
  {
    value: "~$0.00",
    label: "Transaction fees",
  },
  {
    value: "6+",
    label: "Framework integrations",
  },
];

export default function StatsSection() {
  return (
    <div className="bg-primary px-10 py-16">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-evenly gap-10 text-center sm:flex-row">
        {stats.map((stat) => (
          <div key={stat.label} className="flex-1">
            <h1 className="text-primary-foreground mb-2 text-5xl leading-none font-bold">{stat.value}</h1>
            <div className="text-primary-foreground/70 text-sm font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
