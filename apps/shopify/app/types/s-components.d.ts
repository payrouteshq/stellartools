// Shopify Polaris web components (s-*) are globally registered in the Shopify Admin iframe.
// These declarations make them available as JSX elements in TypeScript.

import type { ReactNode, MouseEventHandler, FormEventHandler } from "react";

type SChildren = { children?: ReactNode };
type SClick = { onClick?: MouseEventHandler<HTMLElement> };
type SBase = SChildren & SClick & { id?: string; slot?: string; class?: string; key?: string | number | null };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      // Layout
      "s-page": SBase & { heading?: string; inlineSize?: string };
      "s-section": SBase & { heading?: string; padding?: string };
      "s-stack": SBase & { direction?: "inline" | "block"; gap?: string; alignItems?: string; wrap?: boolean };
      "s-grid": SBase & { gridTemplateColumns?: string; gap?: string };
      "s-box": SBase & { padding?: string; background?: string; border?: string; borderRadius?: string; minWidth?: string };
      "s-divider": SBase & { direction?: string; color?: string };
      "s-query-container": SBase & { containerName?: string };

      // Typography
      "s-heading": SBase;
      "s-text": SBase & { type?: "strong" | "emphasis" | "code"; tone?: string; color?: string };
      "s-paragraph": SBase & { tone?: string; color?: string };
      "s-link": SBase & { href?: string; tone?: string; target?: string };

      // Media
      "s-image": SBase & { src?: string; alt?: string; aspectRatio?: string; objectFit?: string; loading?: string };
      "s-thumbnail": SBase & { src?: string; alt?: string; size?: string };
      "s-avatar": SBase & { initials?: string; src?: string; size?: string; alt?: string };
      "s-icon": SBase & { type?: string; tone?: string; color?: string; size?: string; interestFor?: string };
      "s-spinner": SBase & { size?: string; accessibilityLabel?: string };

      // Data display
      "s-badge": SBase & { tone?: string; color?: string; icon?: string; size?: string };
      "s-chip": SBase & { color?: string; accessibilityLabel?: string };
      "s-clickable-chip": SBase & { color?: string; removable?: boolean; accessibilityLabel?: string };
      "s-tooltip": SBase & { id?: string };

      // Table
      "s-table": SBase & { variant?: "auto" | "responsive" };
      "s-table-header-row": SBase;
      "s-table-header": SBase & { listSlot?: "primary" | "labeled" | "auxiliary"; format?: string };
      "s-table-body": SBase;
      "s-table-row": SBase;
      "s-table-cell": SBase;

      // Feedback
      "s-banner": SBase & { heading?: string; tone?: string; dismissible?: boolean };

      // Actions
      "s-button": SBase & {
        variant?: "primary" | "secondary" | "tertiary" | "plain";
        tone?: string;
        type?: "button" | "submit" | "reset";
        loading?: boolean;
        disabled?: boolean;
        icon?: string;
        form?: string;
        name?: string;
        value?: string;
        commandFor?: string;
      };
      "s-button-group": SBase & { gap?: string };
      "s-menu": SBase & { accessibilityLabel?: string };
      "s-clickable": SBase & { href?: string; padding?: string; background?: string };

      // Overlays
      "s-modal": SBase & { heading?: string; size?: string; open?: boolean };
      "s-popover": SBase & { inlineSize?: string };

      // Form fields
      "s-text-field": SBase & {
        label?: string;
        name?: string;
        value?: string;
        defaultValue?: string;
        placeholder?: string;
        required?: boolean;
        icon?: string;
        autocomplete?: string;
        onChange?: FormEventHandler<HTMLElement>;
        onInput?: FormEventHandler<HTMLElement>;
      };
      "s-password-field": SBase & {
        label?: string;
        name?: string;
        value?: string;
        defaultValue?: string;
        placeholder?: string;
        required?: boolean;
        autocomplete?: string;
        minLength?: number;
        onChange?: FormEventHandler<HTMLElement>;
        onInput?: FormEventHandler<HTMLElement>;
      };
      "s-email-field": SBase & { label?: string; name?: string; placeholder?: string; autocomplete?: string; required?: boolean };
      "s-number-field": SBase & { label?: string; name?: string; min?: number; max?: number; step?: number; inputMode?: string };
      "s-money-field": SBase & { label?: string; name?: string; min?: number; max?: number };
      "s-search-field": SBase & { label?: string; name?: string; placeholder?: string; labelAccessibilityVisibility?: string };
      "s-url-field": SBase & { label?: string; name?: string; placeholder?: string; autocomplete?: string };
      "s-text-area": SBase & { label?: string; name?: string; rows?: number; maxLength?: number };
      "s-select": SBase & { label?: string; name?: string; placeholder?: string; onChange?: FormEventHandler<HTMLElement> };
      "s-option": SBase & { value?: string };
      "s-checkbox": SBase & { label?: string; name?: string; value?: string; checked?: boolean; defaultChecked?: boolean };
      "s-switch": SBase & { label?: string; name?: string; checked?: boolean; defaultChecked?: boolean };
      "s-choice-list": SBase & { label?: string; name?: string; value?: string; onChange?: FormEventHandler<HTMLElement> };
      "s-choice": SBase & { value?: string; checked?: boolean; defaultChecked?: boolean };
      "s-color-field": SBase & { label?: string; name?: string; value?: string; alpha?: boolean };
      "s-color-picker": SBase & { name?: string; value?: string; alpha?: boolean };
      "s-date-field": SBase & { label?: string; name?: string; value?: string; allow?: string; required?: boolean };
      "s-date-picker": SBase & { type?: string; name?: string; value?: string };
      "s-drop-zone": SBase & { label?: string; name?: string; accept?: string; multiple?: boolean };

      // Lists
      "s-ordered-list": SBase;
      "s-unordered-list": SBase;
      "s-list-item": SBase;
    }
  }
}
