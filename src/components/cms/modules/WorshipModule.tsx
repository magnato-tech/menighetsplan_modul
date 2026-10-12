import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { eventPath } from "../../../utils/gatheringPresentation";
import { CmsResolvedLink } from "../CmsResolvedLink";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { locationOf, pickHighlight } from "../../../utils/gatherings";
import { useResolvedMediaUrl } from "../../../hooks/useMediaMap";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";
import { PresentationSection } from "../PresentationSection";
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Coffee,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export interface WorshipModuleProps {
  variant?: "highlight" | "compact";
  titleOverride?: string;
  presentation?: ModulePresentationConfig;
}

export const WorshipModule: React.FC<WorshipModuleProps> = ({
  variant = "highlight",
  titleOverride,
  presentation,
}) => {
  const { gatherings } = useFirebase();
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-worship"];
  const defaults = MODULE_PRESENTATION_DEFAULTS["module-worship"];

  const highlight = useMemo(() => pickHighlight(gatherings, Date.now()), [gatherings]);
  const nextWorship = highlight?.gathering;
  const image = useResolvedMediaUrl(nextWorship?.imageUrl);
  const autoLabel =
    highlight?.kind === "featured"
      ? "Fremhevet samling"
      : highlight?.kind === "next"
      ? "Neste arrangement"
      : "Neste Gudstjeneste";
  const highlightLabel =
    titleOverride ||
    presentationText(config, "badge", autoLabel);
  const linkLabel = presentationText(config, "linkLabel", defaults.linkLabel);
  const linkUrl = presentationText(config, "linkUrl", defaults.linkUrl);

  const infoCards = [
    {
      icon: Sparkles,
      iconClass: "bg-accent-50 text-accent-700",
      title: presentationText(config, "info1Title", defaults.info1Title),
      body: presentationText(config, "info1Body", defaults.info1Body),
    },
    {
      icon: Coffee,
      iconClass: "bg-primary-50 text-primary-700",
      title: presentationText(config, "info2Title", defaults.info2Title),
      body: presentationText(config, "info2Body", defaults.info2Body),
    },
    {
      icon: BookOpen,
      iconClass: "bg-emerald-50 text-emerald-700",
      title: presentationText(config, "info3Title", defaults.info3Title),
      body: presentationText(config, "info3Body", defaults.info3Body),
    },
  ];

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("no-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return "";
    }
  };

  if (variant === "compact") {
    return (
      <PresentationSection
        config={config}
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6"
      >
        <div className="bg-white rounded-xl border border-stone-200/90 p-4 sm:p-5 shadow-sm hover:border-primary-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-800 flex items-center justify-center shrink-0 font-bold">
              <Calendar className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 block">
                {highlightLabel}
              </span>
              <h3 className="font-bold text-stone-900 text-base">
                {nextWorship ? nextWorship.title : "Ingen planlagte samlinger"}
              </h3>
              {nextWorship && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 mt-0.5">
                  <span className="capitalize">{formatDate(nextWorship.startsAt)}</span>
                  <span>·</span>
                  <span>Kl. {formatTime(nextWorship.startsAt)}</span>
                  <span>·</span>
                  <span>{locationOf(nextWorship)}</span>
                </div>
              )}
            </div>
          </div>

          <CmsResolvedLink
            raw={linkUrl}
            fallback={defaults.linkUrl}
            className="px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
          >
            <span>{linkLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
          </CmsResolvedLink>
        </div>
      </PresentationSection>
    );
  }

  return (
    <PresentationSection
      config={config}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8 relative z-10"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200/80 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100">
          {image && (
            <img
              src={image}
              alt={nextWorship?.imageAlt?.trim() || ""}
              className="w-full lg:w-80 aspect-video object-cover rounded-xl shrink-0 bg-stone-100"
            />
          )}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary-50 text-primary-800 text-xs font-bold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-primary-600" />
              <span>{highlightLabel}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              {nextWorship ? nextWorship.title : "Ingen samlinger er lagt ut ennå"}
            </h2>
            {nextWorship?.theme && (
              <p className="text-sm font-medium text-stone-600">
                <span className="font-semibold text-stone-800">Tema:</span> {nextWorship.theme}
                {nextWorship.bibleText && ` (${nextWorship.bibleText})`}
              </p>
            )}
            {nextWorship?.summary?.trim() && <p className="text-sm text-stone-600 leading-relaxed">{nextWorship.summary.trim()}</p>}
            {nextWorship && (
              <Link to={eventPath(nextWorship.id)} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:text-primary-900">
                <span>Les mer om arrangementet</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          {nextWorship && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-700 bg-stone-50 p-4 rounded-xl border border-stone-200/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                <span className="font-semibold capitalize">{formatDate(nextWorship.startsAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" />
                <span>Kl. {formatTime(nextWorship.startsAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-600" />
                <span>{locationOf(nextWorship)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-stone-600">
          {infoCards.map((card) => (
            <div key={card.title} className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.iconClass}`}
              >
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">{card.title}</h4>
                <p className="mt-0.5 text-stone-500 leading-relaxed">{card.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PresentationSection>
  );
};
