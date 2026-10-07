import React from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useCms } from "../../context/CmsContext";
import { useFirebase } from "../../context/FirebaseDataContext";
import { CmsPage } from "../../data/cmsData";
import { toPublicProfile } from "../../utils/publicProfile";
import {
  ArrowLeft,
  Heart,
  Phone,
  Mail,
  Clock,
  Users,
} from "lucide-react";
import { VisualBlockFlow } from "../../components/cms/VisualBlockFlow";
import { resolveVisualBlocks } from "../../utils/cmsBlocks";
import { buildLinkContext, ensureSectionAnchors, resolveCmsLinkForDisplay } from "../../utils/cmsLinks";
import { HeroButtons } from "../../components/cms/HeroButtons";
import { isPagePublished } from "../../utils/menu";
import { formatNorwegianDateTime } from "../../utils/dates";
import { usePreviewPageDraft } from "../../hooks/usePreviewPageDraft";
import { useResolvedMediaUrl } from "../../hooks/useMediaMap";
import { useLocation } from "react-router-dom";

interface PublicStaticPageProps {
  forcedSlug?: string;
  fallbackComponent?: React.ReactNode;
  pageOverride?: Partial<CmsPage>;
  hidePreviewBanner?: boolean;
  relaxLinkValidation?: boolean;
}

export const PublicStaticPage: React.FC<PublicStaticPageProps> = ({
  forcedSlug,
  fallbackComponent,
  pageOverride,
  hidePreviewBanner,
  relaxLinkValidation: relaxLinkValidationProp = false,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get("preview") === "true";
  const isEmbedded = searchParams.get("embedded") === "1";
  const { getPageBySlug, settings, pages } = useCms();
  const { allPersons } = useFirebase();
  const linkContext = React.useMemo(() => buildLinkContext(pages), [pages]);

  const currentSlug = pageOverride?.slug || forcedSlug || paramSlug || "om-oss";
  const savedPage = getPageBySlug(currentSlug);

  const { draftPage, isLiveDraft, relaxLinkValidation: relaxFromPreview } = usePreviewPageDraft(
    savedPage,
    location.pathname
  );
  const relaxLinkValidation = relaxLinkValidationProp || relaxFromPreview;

  const page = pageOverride
    ? ({ ...savedPage, ...pageOverride } as CmsPage)
    : draftPage
    ? ({ ...savedPage, ...draftPage } as CmsPage)
    : savedPage;

  const heroImageSrc = useResolvedMediaUrl(page?.heroImage);
  const heroImageAlt = page?.heroImageAlt?.trim() || "";

  const isAvailable = page
    ? Boolean(pageOverride) || isLiveDraft || isPagePublished(page)
    : false;

  if (!page || !isAvailable) {
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }
    const isFutureScheduled =
      Boolean(page && page.publishAt && new Date(page.publishAt).getTime() > Date.now());

    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black text-stone-900">
          {isFutureScheduled ? "Siden er planlagt publisert" : "Siden ble ikke funnet"}
        </h1>
        <p className="text-sm text-stone-600">
          {isFutureScheduled && page?.publishAt
            ? `Denne siden blir automatisk tilgjengelig for publikum ${formatNorwegianDateTime(page.publishAt)}.`
            : `Siden med adresse «/${currentSlug}» eksisterer ikke eller er ikke publisert ennå.`}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tilbake til forsiden</span>
        </Link>
      </div>
    );
  }

  const blocks = ensureSectionAnchors(resolveVisualBlocks(page));
  const primaryLink = resolveCmsLinkForDisplay(page.heroCtaLink, linkContext, {
    relaxValidation: relaxLinkValidation,
  });
  const secondaryLink = resolveCmsLinkForDisplay(page.heroCtaSecondaryLink, linkContext, {
    relaxValidation: relaxLinkValidation,
  });
  const isAboutPage = currentSlug.includes("om-oss");
  const isContactPage = currentSlug.includes("kontakt");
  // Made of what the congregation has filled in. With nothing filled in, the line is not shown.
  const givingLine = [settings.vippsNumber && `Vipps: ${settings.vippsNumber}`, settings.bankAccount && `Konto: ${settings.bankAccount}`]
    .filter(Boolean)
    .join(" · ");
  const contactLine = [settings.email, settings.phone && `Tlf ${settings.phone}`].filter(Boolean).join(" · ");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      {/* Top Banner when previewing draft */}
      {isPreviewMode && !hidePreviewBanner && !isEmbedded && (
        <div className="bg-stone-900 text-stone-200 border border-stone-700 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
            <span className="font-bold text-stone-100">Forhåndsvisning av utkast</span>
            <span className="text-stone-300 hidden sm:inline">· Ekte offentlig layout og styling</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-stone-800 px-2 py-0.5 rounded border border-stone-700">
              {page.isPublished === false ? "Status: Kladd (upublisert)" : "Status: Publisert"}
            </span>
            <Link
              to="/admin?tab=pages"
              className="text-[11px] font-semibold text-white bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-lg transition-colors border border-stone-600"
            >
              Tilbake til CMS
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tilbake til forsiden</span>
        </Link>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight">
          {page.heroTitle?.trim() || page.title}
        </h1>
        {page.summary && (
          <p className="text-base sm:text-lg text-stone-600 max-w-2xl font-medium leading-relaxed">
            {page.summary}
          </p>
        )}
        <HeroButtons
          tone="on-light"
          align="start"
          showPrimary={page.showHeroPrimaryCta !== false}
          showSecondary={page.showHeroSecondaryCta !== false}
          primaryText={page.heroCtaText?.trim() || undefined}
          primaryLink={primaryLink || undefined}
          secondaryText={page.heroCtaSecondaryText?.trim() || undefined}
          secondaryLink={secondaryLink || undefined}
        />
      </div>

      {/* Hovedbilde (Hero Image) */}
      {heroImageSrc && (
        <div className="w-full h-40 sm:h-52 md:h-64 rounded-2xl overflow-hidden border border-stone-200/80 shadow-xs relative bg-stone-100">
          <img
            src={heroImageSrc}
            alt={heroImageAlt}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 sm:p-10 shadow-xs space-y-4">
        <VisualBlockFlow blocks={blocks} embed />
      </div>

      {/* Lederskap & Stab (vises under Om oss hvis ikke allerede inkludert i blokk) */}
      {isAboutPage &&
        !(page.content || "").includes(":::personer") &&
        !(page.content || "").includes(":::stab") && (
        <section className="space-y-6 pt-4">
          <div className="border-b border-stone-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-700" />
                <span>Lederskap & Stab</span>
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Pastoren, ansatte i staben og menighetens valgte lederskap.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/stab"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 hover:text-primary-900 bg-primary-50 px-3.5 py-2 rounded-xl transition-colors"
              >
                <span>Våre ansatte (Stab)</span>
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              </Link>
              <Link
                to="/lederskap"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 px-3.5 py-2 rounded-xl transition-colors"
              >
                <span>Valgt lederskap</span>
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {allPersons
              .filter((p) => p.isStaff && toPublicProfile(p))
              .map((person) => {
                const profile = toPublicProfile(person)!;
                return (
                  <div
                    key={person.id}
                    className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs hover:border-primary-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {profile.avatarUrl ? (
                        <div className="w-full h-48 bg-stone-100 overflow-hidden">
                          <img
                            src={profile.avatarUrl}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-stone-100 flex items-center justify-center text-3xl font-bold text-stone-400">
                          {profile.name.charAt(0)}
                        </div>
                      )}
                      <div className="p-4 space-y-1.5">
                        <h3 className="font-bold text-stone-900 text-base">{profile.name}</h3>
                        <p className="text-xs text-primary-700 font-semibold">{profile.title || "Medarbeider"}</p>
                        {profile.bio && <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">{profile.bio}</p>}
                      </div>
                    </div>

                    {(profile.phone || profile.email) && (
                      <div className="p-4 pt-2 border-t border-stone-100 flex flex-col gap-1 text-xs text-stone-600">
                        {profile.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-stone-400" />
                            <a href={`tel:${profile.phone}`} className="hover:text-stone-900 font-medium">
                              {profile.phone}
                            </a>
                          </div>
                        )}
                        {profile.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-stone-400" />
                            <a href={`mailto:${profile.email}`} className="hover:text-stone-900 truncate font-medium">
                              {profile.email}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Special highlight box for Contact Page */}
      {isContactPage && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="bg-primary-50/70 border border-primary-100 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-primary-950 text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary-700" />
              <span>Givertjeneste & Skattefradrag</span>
            </h3>
            <p className="text-xs text-primary-900/80 leading-relaxed">
              Vi setter stor pris på alle faste givere og enkeltgaver. Gaver over 500 kr i året rapporteres til Skatteetaten for fradrag dersom du oppgir fødselsnummer.
            </p>
            {givingLine && <div className="pt-2 text-xs font-bold text-primary-950">{givingLine}</div>}
          </div>

          <div className="bg-stone-100 border border-stone-200 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-700" />
              <span>Kontortid & Samtaler</span>
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Pastoren og menighetens ledere er tilgjengelige for personlige samtaler, sjelesorg, bønn eller praktiske spørsmål. Ta kontakt via e-post eller telefon.
            </p>
            {contactLine && <div className="pt-2 text-xs font-bold text-stone-800">{contactLine}</div>}
          </div>
        </div>
      )}
    </div>
  );
};
