// FILE: logo.tsx
// Purpose: Render the Ramspace mark as an inline SVG that follows theme foreground color.
// Shared branding primitive used by the web app and the public profile page.
// Layer: profile-ui shared component.

import type { SVGProps } from "react";
import { cn } from "./cn";

// Shared SVG path data for the Ramspace mark.
export const RAMSPACE_LOGO_PATHS = [
  "M 44.8198284212995 74.10634820483463 A 24.2878 7.64159 -33.2303 1 0 4.187571578700499 100.72605179516538 A 24.2878 7.64159 -33.2303 1 0 44.8198284212995 74.10634820483463 Z",
  "M 56.1910155561579 81.31069058080442 A 28.1613 9.5585 -82.1189 1 0 48.4681844438421 137.1013094191956 A 28.1613 9.5585 -82.1189 1 0 56.1910155561579 81.31069058080442 Z",
  "M 67.07005774387787 74.51081912507583 A 33.2334 12.5877 -156.105 1 0 127.83994225612213 101.43398087492416 A 33.2334 12.5877 -156.105 1 0 67.07005774387787 74.51081912507583 Z",
  "M 68.44495139197248 61.74097261672672 A 35.0773 12.2864 147.698 1 0 127.74264860802752 24.251627383273274 A 35.0773 12.2864 147.698 1 0 68.44495139197248 61.74097261672672 Z",
  "M 55.37608869085738 53.461354545739354 A 26.5749 6.39096 93.897 1 0 58.988311309142624 0.4344454542606435 A 26.5749 6.39096 93.897 1 0 55.37608869085738 53.461354545739354 Z",
  "M 45.82081674462792 61.77166317726472 A 18.8216 4.871 27.9771 1 0 12.576783255372074 44.11253682273529 A 18.8216 4.871 27.9771 1 0 45.82081674462792 61.77166317726472 Z",
] as const;

export function RamspaceLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  const ariaLabel = props["aria-label"];

  return (
    <svg
      viewBox="0 0 135 139"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaLabel ? undefined : true}
      {...props}
      className={cn("shrink-0 text-foreground", className)}
    >
      {RAMSPACE_LOGO_PATHS.map((path) => (
        <path key={path} d={path} fill="currentColor" />
      ))}
    </svg>
  );
}
