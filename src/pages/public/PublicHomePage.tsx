import React from "react";

import { Link, useSearchParams } from "react-router-dom";

import { useCms } from "../../context/CmsContext";

import { VisualBlockFlow } from "../../components/cms/VisualBlockFlow";

import { HeroButtons } from "../../components/cms/HeroButtons";

import { CMS_PREVIEW_TARGET_HERO, resolveVisualBlocks } from "../../utils/cmsBlocks";

import {

  buildLinkContext,

  defaultHomePrimaryLink,

  ensureSectionAnchors,

  resolveCmsLinkForDisplay,

} from "../../utils/cmsLinks";

import { usePreviewPageDraft } from "../../hooks/usePreviewPageDraft";
import { useMediaMap, useResolvedMediaUrl } from "../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../utils/media";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBackdrop, useHeroSlides } from "../../components/public/HeroBackdrop";
import {
  HERO_TITLE_SIZE_CLASSES,
  heroFontFaceCss,
  heroFontFamily,
  heroHeightOf,
  heroMenuStyleOf,
  heroSlidesOf,
  heroSubtextOf,
  heroTitleFontOf,
  heroTitleSizeOf,
  heroTitleStyleOf,
  heroVeilOf,
} from "../../utils/heroLayout";




/** The least height of the picture at the top, for each choice (see utils/heroLayout.ts). */
const HERO_MIN_HEIGHT = { low: "min-h-[50vh]", medium: "min-h-[72vh]", full: "min-h-[100svh]" } as const;

interface PublicHomePageProps {

  pageOverride?: Partial<import("../../data/cmsData").CmsPage>;

  hidePreviewBanner?: boolean;

  relaxLinkValidation?: boolean;

}



export const PublicHomePage: React.FC<PublicHomePageProps> = ({

  pageOverride,

  hidePreviewBanner,

  relaxLinkValidation: relaxLinkValidationProp = false,

}) => {

  const [searchParams] = useSearchParams();

  const isPreviewMode = searchParams.get("preview") === "true";

  const isEmbedded = searchParams.get("embedded") === "1";

  const { pages, settings } = useCms();



  const savedHome =

    pages.find((p) => p.slug === "forside" || p.slug === "" || p.linkUrl === "/") || null;



  const { draftPage, isLiveDraft, relaxLinkValidation: relaxFromPreview } = usePreviewPageDraft(

    savedHome,

    "/"

  );



  const activePage =

    pageOverride ||

    draftPage ||

    savedHome ||

    null;



  const relaxLinkValidation = relaxLinkValidationProp || relaxFromPreview;



  const heroHeadline =

    activePage?.heroTitle?.trim() ||

    (activePage?.title && activePage.title !== "Forside" ? activePage.title : settings.welcomeHeadline) ||

    "Velkommen til menighetens fellesskap";



  const heroSubtext = heroSubtextOf(
    activePage,
    settings,
    "Et åpent hjem for alle generasjoner. Vi samles til gudstjeneste, bønn og nære fellesskap der tro og hverdag møtes."
  );
  const heroHeight = heroHeightOf(activePage);
  const calmTitle = heroTitleStyleOf(activePage) === "calm";
  const titleSize = heroTitleSizeOf(activePage);
  const titleFont = heroTitleFontOf(activePage);



  const heroImage = useResolvedMediaUrl(activePage?.heroImage);
  const mediaById = useMediaMap();
  // The main image and up to two more, each with its headline. With several, the hero fades from one to the next.
  const slides = heroSlidesOf(
    heroImage,
    (activePage?.heroImages ?? []).map((value) => resolveMediaUrl(value, mediaById, "web")),
    activePage?.heroImageTitles,
    heroHeadline
  );
  const heroImages = slides.map((slide) => slide.src);
  const { shown, go } = useHeroSlides(heroImages.length);
  const shownHeadline = slides[shown.active]?.title ?? heroHeadline;
  // The headline fades in anew only when the pictures have titles of their own
  const titlesTurn = new Set(slides.map((slide) => slide.title)).size > 1;
  const showArrows = activePage?.heroArrows === true;
  // With the menu on top of the hero (see PublicNavbar.tsx), the headline is moved down clear of it
  // The embedded preview in the editor shows it as the website does; the preview in a tab of its own has a banner on top
  const menuOnHero = heroImages.length > 0 && heroMenuStyleOf(activePage) !== "white" && (!isPreviewMode || isEmbedded);
  const veil = heroVeilOf(activePage);
  // Without the dark veil the text gets a soft shadow, so it can still be read on a light picture
  const textShadow = veil === "dark" ? "" : "[text-shadow:0_2px_14px_rgba(0,0,0,0.55)]";
  const heroImageAlt = activePage?.heroImageAlt?.trim() || "";

  const showPrimaryCta = activePage?.showHeroPrimaryCta !== false;

  const showSecondaryCta = activePage?.showHeroSecondaryCta !== false;

  const linkContext = React.useMemo(() => buildLinkContext(pages), [pages]);

  const primaryText = showPrimaryCta

    ? activePage?.heroCtaText?.trim() || "Se hva som skjer"

    : undefined;

  const primaryLink = resolveCmsLinkForDisplay(activePage?.heroCtaLink, linkContext, {

    fallback: activePage?.heroCtaLink?.trim() ? undefined : defaultHomePrimaryLink(pages),

    relaxValidation: relaxLinkValidation,

  });

  const secondaryText = showSecondaryCta

    ? activePage?.heroCtaSecondaryText?.trim() || "Bli kjent med oss"

    : undefined;

  const secondaryLink = resolveCmsLinkForDisplay(activePage?.heroCtaSecondaryLink, linkContext, {

    fallback: activePage?.heroCtaSecondaryLink?.trim() ? undefined : "/om-oss",

    relaxValidation: relaxLinkValidation,

  });



  const liveDraft = Boolean(pageOverride || isLiveDraft);

  const blocks = ensureSectionAnchors(

    resolveVisualBlocks(

      liveDraft ? activePage : activePage ? { ...activePage, blocks: undefined } : { content: "" },

      { home: true }

    )

  );



  return (

    <div className="space-y-8 sm:space-y-12 pb-16">

      {isPreviewMode && !hidePreviewBanner && !isEmbedded && (

        <div className="bg-stone-900 text-stone-200 border-b border-stone-700 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md sticky top-0 z-50 backdrop-blur-md">

          <div className="flex items-center gap-2">

            <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />

            <span className="font-bold text-stone-100">Forhåndsvisning: Forside</span>

            <span className="text-stone-300 hidden sm:inline">· Ekte offentlig forside med modularkitektur</span>

          </div>

          <Link

            to="/admin?tab=pages"

            className="text-[11px] font-semibold text-white bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-lg transition-colors border border-stone-600"

          >

            Tilbake til CMS

          </Link>

        </div>

      )}



      <section

        data-cms-preview-target={CMS_PREVIEW_TARGET_HERO}

        className={`relative overflow-hidden bg-gradient-to-b from-stone-900 via-primary-950 to-stone-900 text-white py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8 ${
          heroImages.length > 0 ? `${HERO_MIN_HEIGHT[heroHeight]} flex items-center` : ""
        } ${menuOnHero ? "pt-32 sm:pt-40 lg:pt-44" : ""}`}

      >

          <HeroBackdrop images={heroImages} alt={heroImageAlt} zoom={activePage?.heroZoom !== false} veil={veil} shown={shown} />



          {veil === "dark" && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />}



          <div className="relative z-10 w-full max-w-5xl mx-auto text-center space-y-6">



            {titleFont !== "heading" && <style>{heroFontFaceCss(titleFont)}</style>}
            <h1
              key={titlesTurn ? shownHeadline : undefined}
              style={{ fontFamily: heroFontFamily(titleFont) }}
              className={`text-white leading-tight ${textShadow} ${HERO_TITLE_SIZE_CLASSES[titleSize]} ${
                calmTitle ? "font-normal" : "font-black"
              } ${titleFont === "caps" ? "uppercase tracking-wide" : calmTitle ? "tracking-normal" : "tracking-tight"} ${
                titlesTurn ? "hero-title-in" : ""
              }`}
            >
              {shownHeadline}
            </h1>
            {heroSubtext && (
              <p className={`max-w-2xl mx-auto text-base sm:text-lg leading-relaxed font-normal ${veil === "dark" ? "text-stone-300" : `text-white ${textShadow}`}`}>
                {heroSubtext}
              </p>
            )}



            <HeroButtons

              showPrimary={showPrimaryCta}

              showSecondary={showSecondaryCta}

              primaryText={primaryText}

              primaryLink={primaryLink || undefined}

              secondaryText={secondaryText}

              secondaryLink={secondaryLink || undefined}

            />

          </div>

          {heroImages.length > 1 && showArrows && (
            <>
              <button
                type="button"
                onClick={() => go(shown.active - 1)}
                aria-label="Forrige bilde"
                className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-black/25 hover:bg-black/45 text-white backdrop-blur-sm transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => go(shown.active + 1)}
                aria-label="Neste bilde"
                className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-black/25 hover:bg-black/45 text-white backdrop-blur-sm transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {heroImages.length > 1 && (
            <div data-hero-dots className="absolute bottom-4 sm:bottom-6 inset-x-0 z-20 flex justify-center gap-1">
              {heroImages.map((src, index) => (
                <button
                  key={`${index}-${src}`}
                  type="button"
                  onClick={() => go(index)}
                  aria-label={`Bilde ${index + 1} av ${heroImages.length}`}
                  aria-current={index === shown.active ? "true" : undefined}
                  className="p-1.5 group"
                >
                  <span
                    className={`block h-2.5 rounded-full shadow-sm transition-all duration-300 ${
                      index === shown.active ? "w-7 bg-white" : "w-2.5 bg-white/50 group-hover:bg-white/80"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

      </section>



      <div data-cms-surface={liveDraft ? undefined : "public"}>

        <VisualBlockFlow blocks={blocks} />

      </div>

    </div>

  );

};


