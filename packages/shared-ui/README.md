# @stellartools/shared-ui

Shared React component library for Stellar Tools. Contains all story-backed UI components and primitives.

```bash
pnpm add @stellartools/shared-ui
```

Peer dependencies: `react`, `react-dom`, `next`, and `@stellartools/core`.

## Storybook preview

**[698b71db4030225770a2a4ba-dlaodvfhew.chromatic.com](https://698b71db4030225770a2a4ba-dlaodvfhew.chromatic.com/)**

## Usage

```tsx
import { Button, DataTable, TextField, useCopy } from "@stellartools/shared-ui";
```

All components and hooks are available from the single barrel export — no sub-path imports needed.

## Development

```bash
# From the repo root
pnpm storybook          # start Storybook on port 6006
pnpm build-storybook    # build Storybook for static hosting
pnpm type-check         # run tsc --noEmit
```

## What's included

**Custom blocks** — `AppModal`, `AreaChart`, `Checklist`, `CircularProgress`, `CodeBlock`, `DataTable`, `DateField`, `EmbeddedFieldRow`, `FieldStack`, `FileUpload`, `LineChart`, `Log`, `Markdown`, `NumberField`, `OptionFlow`, `PhoneNumberField`, `ResourceField`, `SelectInput`, `SelectField`, `Spinner`, `TagInput`, `TextField`, `Time`, `Timeline`

**UI primitives** — `Accordion`, `AlertDialog`, `Avatar`, `Badge`, `Breadcrumb`, `Button`, `Calendar`, `Card`, `Checkbox`, `Collapsible`, `Command`, `Dialog`, `Drawer`, `DropdownMenu`, `Input`, `InputGroup`, `InputOtp`, `Label`, `NavigationMenu`, `Popover`, `RadioGroup`, `ScrollArea`, `Select`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `Slider`, `Switch`, `Table`, `Tabs`, `Textarea`, `Toast`, `Tooltip`

**Hooks** — `useFilePreview`, `useCopy`
