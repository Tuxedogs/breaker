import { createContext } from "react";

export type SignatureDockContextValue = {
  enabled: boolean;
  minimized: boolean;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  setMinimized: (minimized: boolean) => void;
};

export const SignatureDockContext = createContext<SignatureDockContextValue | null>(null);
