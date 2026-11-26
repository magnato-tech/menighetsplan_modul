import type { Dispatch, SetStateAction } from "react";

// The tabs of the person card, in the order they are shown. The address names them with the ids on the left.
export const PERSON_TABS = [
  { id: "profil", label: "Profil" },
  { id: "tjeneste", label: "Grupper og tjeneste" },
  { id: "medlemskap", label: "Medlemskap" },
  { id: "tilgang", label: "Tilgang" },
  { id: "nettside", label: "Nettside" },
] as const;
export type PersonTab = (typeof PERSON_TABS)[number]["id"];
export type PersonTabItem = (typeof PERSON_TABS)[number];
export const toPersonTab = (value: string | null): PersonTab | null => PERSON_TABS.find((tab) => tab.id === value)?.id ?? null;
export const personTabId = (tab: PersonTab) => `person-tab-${tab}`;
export const personPanelId = (tab: PersonTab) => `person-panel-${tab}`;

// The page keeps every field and its setter; the sections only receive them
export type Setter<T> = Dispatch<SetStateAction<T>>;
export type StaffCategory = "pastor" | "stab" | "barneleder" | "diakoni" | "annet";
export type UnavailablePeriod = { from: string; to: string; reason?: string };
