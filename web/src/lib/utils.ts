import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const INPUT_CLS =
  "h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50";
