"use client";
import { createContext, useContext } from "react";
import type { User } from "./api";
export const AccountContext = createContext<User | null>(null);
export const useAccount = () => useContext(AccountContext);
