import { useContext } from "react";

import { SignatureDockContext } from "./signatureDockContext";

export function useSignatureDock() {
  const context = useContext(SignatureDockContext);
  if (!context) {
    throw new Error("useSignatureDock must be used within SignatureDockProvider");
  }
  return context;
}