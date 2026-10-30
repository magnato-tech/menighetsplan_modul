import React from "react";
import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { areaOfTab } from "./studioAreas";
import { studioTabUrl, type StudioTab } from "./studio";
import { studioCard, studioPrimaryButton } from "./studioTheme";
import { ChurchSiteLink } from "../../components/ChurchSiteLink";

interface OwnWebsiteGateProps {
  tab: StudioTab;
  children: React.ReactNode;
}

/** CMS tabs are not drawn when the congregation uses its own website instead of ours. */
export const OwnWebsiteGate: React.FC<OwnWebsiteGateProps> = ({ tab, children }) => {
  const { surfaces, surfacesState } = useCms();
  if (surfaces.ownWebsite || areaOfTab(tab) !== "nettside") return <>{children}</>;

  if (surfacesState === "loading") return <p className="text-sm text-[var(--studio-muted)] p-2">Laster fane…</p>;

  return (
    <div className={`${studioCard} max-w-xl mx-auto mt-8 p-8 text-center space-y-4`}>
      <span
        aria-hidden="true"
        className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--studio-row)] border border-[var(--studio-border)] text-[var(--studio-icon)]"
      >
        <Globe className="w-6 h-6" />
      </span>
      <h1 className="text-lg font-black text-[var(--studio-text)]">Nettsiden ligger hos menigheten</h1>
      <p className="text-xs text-[var(--studio-muted)]">
        Vår nettside er slått av. Rediger innhold på menighetens egen side, og bruk planleggingen her i admin.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link to={studioTabUrl("dashboard")} className={`${studioPrimaryButton} inline-flex items-center px-4 py-2 text-xs`}>
          Til oversikt
        </Link>
        <ChurchSiteLink newTab className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-xl border border-[var(--studio-border)] text-[var(--studio-text)] hover:bg-[var(--studio-row)]">
          Åpne menighetens nettside
        </ChurchSiteLink>
      </div>
    </div>
  );
};
