import type { CSSProperties } from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Delay for the `.stagger` entrance animation (index-based). */
export function stagger(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}
