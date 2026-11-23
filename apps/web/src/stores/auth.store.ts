import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HERO_ASSETS } from "@/data/mock-footwear";
import type { AuthUser } from "@/types/store.types";

export const DEMO_CUSTOMER: AuthUser = {
  id: "cust-abebe",
  name: "Abebe Tadesse",
  email: "abebe.t@gmail.com",
  phone: "+251 911 234 567",
  role: "customer",
  preferredSize: 42,
  subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
  avatarUrl: HERO_ASSETS.customerAvatar,
};

export const DEMO_OWNER: AuthUser = {
  id: "owner-kidus",
  name: "Kidus Assefa",
  email: "kidus@addisgebeyashoes.et",
  phone: "+251 911 234 567",
  role: "admin",
  preferredSize: 42,
  subCity: "Bole Medhanialem HQ",
  avatarUrl: HERO_ASSETS.ownerAvatar,
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, roleOverride?: "customer" | "admin") => AuthUser;
  register: (payload: {
    name: string;
    email: string;
    phone: string;
    preferredSize: number;
    subCity: string;
  }) => AuthUser;
  logout: () => void;
  updateProfile: (patch: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: DEMO_CUSTOMER,
      isAuthenticated: true,

      login: (email, roleOverride) => {
        const normalized = email.trim().toLowerCase();
        const isOwner =
          roleOverride === "admin" ||
          normalized === DEMO_OWNER.email ||
          normalized.includes("admin") ||
          normalized.includes("kidus");

        const loggedUser: AuthUser = isOwner
          ? DEMO_OWNER
          : normalized === DEMO_CUSTOMER.email
            ? DEMO_CUSTOMER
            : {
                ...DEMO_CUSTOMER,
                id: `cust-${Date.now()}`,
                email: normalized,
                name: (normalized.split("@")[0] ?? "Customer")
                  .replace(/[._-]+/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
              };

        set({ user: loggedUser, isAuthenticated: true });
        return loggedUser;
      },

      register: (payload) => {
        const newUser: AuthUser = {
          id: `cust-${Date.now()}`,
          name: payload.name,
          email: payload.email.toLowerCase(),
          phone: payload.phone,
          role: "customer",
          preferredSize: payload.preferredSize,
          subCity: payload.subCity,
        };
        set({ user: newUser, isAuthenticated: true });
        return newUser;
      },

      logout: () => set({ user: null, isAuthenticated: false }),

      updateProfile: (patch) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...patch } });
      },
    }),
    {
      name: "addisgebeya-auth-v1",
    },
  ),
);
