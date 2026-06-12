"use client";

import * as React from "react";

import { useTheme } from "next-themes";
import Image, { ImageProps } from "next/image";

type LogoProps = Omit<ImageProps, "src" | "alt"> & {
  alt?: string;
};

export function Logo({ alt = "StellarTools", ...props }: LogoProps) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const lightSrc = "/images/logo-light.svg";
  const darkSrc = "/images/logo-dark.svg";
  React.useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const resolved = mounted ? (theme === "system" ? systemTheme : theme) : "light";

  const src = resolved === "light" ? darkSrc : lightSrc;

  return <Image src={src} alt={String(alt)} {...props} />;
}

export default Logo;
