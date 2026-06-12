import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content. You can put any content here.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithBorder: Story = {
  render: () => (
    <Card className="w-[350px] border-b">
      <CardHeader className="border-b">
        <CardTitle>Card with borders</CardTitle>
        <CardDescription>Header and footer have borders.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Content area.</p>
      </CardContent>
      <CardFooter className="border-t">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};
