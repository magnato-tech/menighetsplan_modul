import React from "react";
import { Images } from "lucide-react";
import { MediaLibraryPanel } from "../../../components/admin/MediaLibraryPanel";
import { StockImageGrid } from "../../../components/admin/StockImageGrid";
import { StoredImagesCard } from "../../../components/admin/StoredImagesCard";
import type { ShowFeedback } from "../studio";

interface MediaTabProps {
  showFeedback: ShowFeedback;
}

export const MediaTab: React.FC<MediaTabProps> = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-950 border border-[var(--studio-accent-border)]/60">
          <Images className="w-5 h-5 text-[var(--studio-accent-text)]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--studio-text)] tracking-tight">Mediebibliotek</h1>
          <p className="text-xs text-[var(--studio-muted)]">
            Bildene som følger med, og bildene dere har lastet opp selv. Alle kan brukes på tvers av sider og moduler.
          </p>
        </div>
      </div>

      <StoredImagesCard />

      <StockImageGrid />

      <MediaLibraryPanel />
    </div>
  );
};
