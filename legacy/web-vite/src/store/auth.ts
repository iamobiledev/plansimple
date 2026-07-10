import { create } from "zustand";
import type { User } from "../lib/api";

type Session = {
  accessToken: string;
  user: User | null;
};

type AuthState = {
  accessToken: string | null;
  user: User | null;
  hydrate: () => void;
  setSession: (session: Session) => void;
  logout: () => void;
};

function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("ps_access");
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: getStoredAccessToken(),
  user: null,
  hydrate: () => {
    set({ accessToken: getStoredAccessToken() });
  },
  setSession: ({ accessToken, user }) => {
    window.localStorage.setItem("ps_access", accessToken);
    set({ accessToken, user });
  },
  logout: () => {
    window.localStorage.removeItem("ps_access");
    set({ accessToken: null, user: null });
  },
}));
