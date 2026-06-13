"use client";

import * as React from "react";

import UseAnimations from "react-useanimations";
import loadingAnimation from "react-useanimations/lib/loading";

interface Props extends Omit<React.ComponentPropsWithoutRef<typeof UseAnimations>, "animation"> {}

export const Spinner = ({ size = 30, strokeColor = "currentColor", ...props }: Props) => {
  return <UseAnimations animation={loadingAnimation} size={size} strokeColor={strokeColor} {...props} />;
};
