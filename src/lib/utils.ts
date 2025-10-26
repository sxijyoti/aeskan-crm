import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount?: number | null) {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount));
  } catch (e) {
    return `₹${Number(amount).toFixed(2)}`;
  }
}
