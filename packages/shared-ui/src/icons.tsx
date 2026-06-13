import { SVGProps } from "react";

export const CheckMark = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
      clipRule="evenodd"
    />
  </svg>
);

export const PencilIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    width={props.width}
    height={props.height}
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M.975 7.875a1 1 0 0 1 .29-.64L7.44 1.06a1.5 1.5 0 0 1 2.122 0l1.378 1.378a1.5 1.5 0 0 1 0 2.122l-6.173 6.173a1 1 0 0 1-.64.291l-3.09.206a.25.25 0 0 1-.267-.266l.206-3.09Zm1.386 1.764.098-1.477L6.53 4.091 7.91 5.47 3.838 9.54l-1.477.1ZM8.97 4.41l.909-.909L8.5 2.121l-.909.91L8.97 4.408Z"
    />
  </svg>
);
