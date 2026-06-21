import { createContext } from "react";

export type SignatureDockContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
};

export const SignatureDockContext = createContext<SignatureDockContextValue | null>(null);