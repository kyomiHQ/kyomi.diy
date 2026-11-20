import { createContext, useContext } from "react";

export const PreferredLocale = createContext("en");

export function usePreferredLocale() {
  return useContext(PreferredLocale);
}
