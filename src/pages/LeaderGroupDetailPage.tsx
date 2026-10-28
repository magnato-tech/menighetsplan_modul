import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { LeaderGroupCard, type LeaderGroupTab } from "./leaderGroup/LeaderGroupCard";

/** The group card as a page: the group from the address, and the tab from `?tab=`. */
export const LeaderGroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const urlTab = (searchParams.get("tab") as LeaderGroupTab | null) ?? undefined;

  return <LeaderGroupCard groupId={groupId || ""} initialTab={urlTab} />;
};
