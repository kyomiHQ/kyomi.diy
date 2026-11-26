import { createContext, useContext } from "react";

export const PreferredLocale = createContext("en");

export function resolvePreferredLocale(language?: string) {
  if (!language) return "en";
  const locale = language === "ns" ? "nso" : language;
  return Intl.DateTimeFormat.supportedLocalesOf(locale)[0] ?? "en";
}

export function usePreferredLocale() {
  return useContext(PreferredLocale);
}
