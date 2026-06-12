import type { Meta, StoryObj } from "@storybook/react";

import { LineChart } from "./line-chart";

const desktopData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
];

const desktopConfig = {
  desktop: {
    label: "Desktop Users",
    color: "hsl(var(--chart-1))",
  },
};

const revenueData = [
  { date: "2024-03-13", revenue: 1200 },
  { date: "2024-03-14", revenue: 1900 },
  { date: "2024-03-15", revenue: 1500 },
  { date: "2024-03-16", revenue: 2100 },
  { date: "2024-03-17", revenue: 1800 },
  { date: "2024-03-18", revenue: 2400 },
  { date: "2024-03-19", revenue: 2200 },
];

const revenueConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
};

const longSeriesData = Array.from({ length: 30 }, (_, i) => ({
  date: `2024-04-${String(i + 1).padStart(2, "0")}`,
  revenue: 1500 + Math.sin(i / 4) * 800 + Math.random() * 400,
}));

const viewsData = [
  { week: "Week 1", views: 4200 },
  { week: "Week 2", views: 3800 },
  { week: "Week 3", views: 5100 },
  { week: "Week 4", views: 4600 },
  { week: "Week 5", views: 5900 },
];

const viewsConfig = {
  views: {
    label: "Page views",
    color: "hsl(var(--chart-2))",
  },
};

const meta = {
  title: "Components/LineChart",
  component: LineChart,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    showTooltip: {
      control: "boolean",
    },
    showXAxis: {
      control: "boolean",
    },
    color: {
      control: "select",
      options: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"],
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[300px] w-[500px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: desktopData,
    config: desktopConfig,
    xAxisKey: "month",
    activeKey: "desktop",
    color: "var(--chart-1)",
  },
};

export const WithDates: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
  },
};

export const LongSeries: Story = {
  args: {
    data: longSeriesData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
    className: "h-[280px]",
  },
};

export const NonDateXAxis: Story = {
  args: {
    data: viewsData,
    config: viewsConfig,
    xAxisKey: "week",
    activeKey: "views",
    color: "var(--chart-2)",
  },
};

export const CustomXAxisFormatter: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
    xAxisFormatter: (value) => {
      const d = new Date(value as string);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
  },
};

export const CustomTooltipLabelFormatter: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
    tooltipLabelFormatter: (value) => `$${Number(value).toLocaleString()}`,
  },
};

export const NoTooltip: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
    showTooltip: false,
  },
};

export const NoXAxis: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
    showXAxis: false,
  },
};

export const ChartColor2: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-2)",
  },
};

export const ChartColor3: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-3)",
  },
};

export const WithAriaLabel: Story = {
  args: {
    data: revenueData,
    config: revenueConfig,
    xAxisKey: "date",
    activeKey: "revenue",
    color: "var(--chart-1)",
    "aria-label": "Revenue over the last 7 days",
  },
};
