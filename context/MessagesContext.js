import { createContext, useContext } from "react";

export const MessagesContext = createContext(null);

export function useMessages() {
  const context = useContext(MessagesContext);

  if (context === null) {
    throw new Error("useMessages must be used within a MessagesProvider.");
  }

  return context;
}
