import React from "react";
import { useParams } from "react-router-dom";
import { GatheringDetailView } from "../components/GatheringDetailView";

export const LeaderGatheringDetailPage: React.FC = () => {
  const { gatheringId } = useParams<{ gatheringId: string }>();

  return <GatheringDetailView key={gatheringId} gatheringId={gatheringId || ""} mode="leader" />;
};
