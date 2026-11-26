import { createContext } from "react";

type ArrivalTransition = (change: () => Promise<void>, at?: [number, number]) => Promise<void>;

export const InboxArrivalTransition = createContext<ArrivalTransition>((change) => change());
