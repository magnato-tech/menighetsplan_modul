import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Globe2, ShieldCheck, XCircle } from "lucide-react";
import type { AnalyticsPeriod, ContentSummary, PeopleSummary } from "../../../../utils/churchAnalytics";
import { POLICE_CERTIFICATE_WARNING_DAYS } from "../../../../utils/churchAnalytics";
import { describeChange } from "../../../../utils/analyticsFormat";
import type { VisitCounting } from "../../../../utils/siteTraffic";
import { AnalyticsSection, MiniStat } from "./AnalyticsSection";
import type { Person } from "../../../../types";

interface RegisterAndWebsiteSectionProps {
  period: AnalyticsPeriod;
  people: PeopleSummary;
  content: ContentSummary;
  /** Each half is its own module and can be hidden on its own. */
  showRegister: boolean;
  showWebsite: boolean;
  onHideRegister?: () => void;
  onHideWebsite?: () => void;
  /** Whether the website counts its visits. The section says so, and leads to where it is decided. */
  visits: VisitCounting;
  /** Opens the board over visits to the website. */
  onOpenTraffic: () => void;
  /** Opens the page where the add-ons are turned on. */
  onOpenAddons: () => void;
}

const link = "font-semibold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)]";

const PersonList: React.FC<{ persons: Person[] }> = ({ persons }) => (
  <>
    {persons.map((person, index) => (
      <React.Fragment key={person.id}>
        {index > 0 && ", "}
        <Link to={`/admin/person/${person.id}`} className={link}>
          {person.name}
        </Link>
      </React.Fragment>
    ))}
  </>
);

/** The person register as it stands today, and what was published on the website in the period. */
export const RegisterAndWebsiteSection: React.FC<RegisterAndWebsiteSectionProps> = ({
  period,
  people,
  content,
  showRegister,
  showWebsite,
  onHideRegister,
  onHideWebsite,
  visits,
  onOpenTraffic,
  onOpenAddons,
}) => {
  const { policeCertificates: certificates } = people;
  const newsChange = describeChange(content.newsPublished, content.previousNewsPublished);
  const sermonChange = describeChange(content.sermons, content.previousSermons);

  return (
    <div className={`grid grid-cols-1 gap-6 ${showRegister && showWebsite ? "xl:grid-cols-2" : ""}`}>
      {showRegister && (
      <AnalyticsSection
        id="analyse-personregister"
        title="Personregisteret"
        description="Slik registeret står i dag."
        icon={<ShieldCheck className="w-5 h-5" />}
        onHide={onHideRegister}
      >
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Personer" value={String(people.total)}>
            {people.admins} administratorer · {people.staff} i staben
          </MiniStat>
          <MiniStat label="Offentlig profil" value={String(people.publicProfiles)}>
            med registrert samtykke
          </MiniStat>
          <MiniStat label="Borte nå" value={String(people.unavailableNow)}>
            har meldt fravær som gjelder i dag
          </MiniStat>
          <MiniStat label="Politiattest" value={String(certificates.registered)}>
            registrert, {certificates.valid} gyldige lenger enn {POLICE_CERTIFICATE_WARNING_DAYS} dager
          </MiniStat>
        </div>
        {(certificates.expired.length > 0 || certificates.expiringSoon.length > 0) && (
          <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-2 text-xs">
            {certificates.expired.length > 0 && (
              <p className="flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 text-[var(--studio-bad)]" aria-hidden="true" />
                <span>
                  <strong className="text-[var(--studio-text)]">Utløpt politiattest:</strong> <PersonList persons={certificates.expired} />
                </span>
              </p>
            )}
            {certificates.expiringSoon.length > 0 && (
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--studio-warn)]" aria-hidden="true" />
                <span>
                  <strong className="text-[var(--studio-text)]">Går ut innen {POLICE_CERTIFICATE_WARNING_DAYS} dager:</strong>{" "}
                  <PersonList persons={certificates.expiringSoon} />
                </span>
              </p>
            )}
          </div>
        )}
      </AnalyticsSection>
      )}

      {showWebsite && (
      <AnalyticsSection
        id="analyse-nettside"
        title="Nettsiden"
        description={period.direction === "ahead" ? `Hva som er satt opp til publisering ${period.label.toLowerCase()}, og sidene som ligger ute i dag.` : `Hva som er publisert ${period.label.toLowerCase()}.`}
        icon={<Globe2 className="w-5 h-5" />}
        onHide={onHideWebsite}
      >
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Nyheter publisert" value={String(content.newsPublished)}>
            {newsChange ? `${newsChange.text} fra ${period.previousLabel}` : "i perioden"}
          </MiniStat>
          <MiniStat label="Taler lagt ut" value={String(content.sermons)}>
            {content.sermonsWithRecording} med opptak
            {sermonChange ? ` · ${sermonChange.text} fra ${period.previousLabel}` : ""}
          </MiniStat>
          <MiniStat label="Sider på nettsiden" value={String(content.pages.published)}>
            publisert nå
          </MiniStat>
          <MiniStat label="Under arbeid" value={String(content.pages.drafts + content.pages.scheduled)}>
            {content.pages.drafts} kladder · {content.pages.scheduled} planlagt
          </MiniStat>
        </div>
        <p className="text-[11px] text-[var(--studio-muted)]">
          {visits === "counted"
            ? "Besøk på nettsiden telles anonymt, uten å spore de besøkende."
            : visits === "paused"
              ? "Tellingen av besøk på nettsiden er slått av."
              : "Besøk på nettsiden telles ikke. Det gjør modulen «Besøk på nettsiden»."}{" "}
          {/* The board is only there while its add-on is on. Off, the way on goes through the add-ons. */}
          <button type="button" onClick={visits === "off" ? onOpenAddons : onOpenTraffic} className={`${link} cursor-pointer`}>
            {visits === "off" ? "Åpne Moduler" : "Se besøk på nettsiden"}
          </button>
        </p>
      </AnalyticsSection>
      )}
    </div>
  );
};
