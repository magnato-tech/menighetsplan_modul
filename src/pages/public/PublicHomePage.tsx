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
import { HeroBackdrop } from "../../components/public/HeroBackdrop";




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



  const heroSubtext =

    activePage?.summary ||

    settings.welcomeSubtext ||

    "Et åpent hjem for alle generasjoner. Vi samles til gudstjeneste, bønn og nære fellesskap der tro og hverdag møtes.";



  const heroImage = useResolvedMediaUrl(activePage?.heroImage);
  const mediaById = useMediaMap();
  // The main image and up to two more. With several, the hero fades from one to the next.
  const heroImages = [heroImage, ...(activePage?.heroImages ?? []).map((value) => resolveMediaUrl(value, mediaById, "web"))]
    .filter(Boolean)
    .slice(0, 3);
  // With the menu on top of the hero (see PublicNavbar.tsx), the headline is moved down clear of it
  const menuOnHero = heroImages.length > 0 && activePage?.heroMenuOverlay !== false && !isPreviewMode && !isEmbedded;
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
          heroImages.length > 0 ? "min-h-[72vh] flex items-center" : ""
        } ${menuOnHero ? "pt-32 sm:pt-40 lg:pt-44" : ""}`}

      >

          <HeroBackdrop images={heroImages} alt={heroImageAlt} zoom={activePage?.heroZoom !== false} />



          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />



          <div className="relative z-10 w-full max-w-5xl mx-auto text-center space-y-6">



            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">

              {heroHeadline}

            </h1>



            <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-300 leading-relaxed font-normal">

              {heroSubtext}

            </p>



            <HeroButtons

              showPrimary={showPrimaryCta}

              showSecondary={showSecondaryCta}

              primaryText={primaryText}

              primaryLink={primaryLink || undefined}

              secondaryText={secondaryText}

              secondaryLink={secondaryLink || undefined}

            />

          </div>

      </section>



      <div data-cms-surface={liveDraft ? undefined : "public"}>

        <VisualBlockFlow blocks={blocks} />

      </div>

    </div>

  );

};


