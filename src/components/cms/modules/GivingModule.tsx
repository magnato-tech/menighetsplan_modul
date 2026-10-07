import React from "react";
import { useCms } from "../../../context/CmsContext";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";
import { PresentationSection } from "../PresentationSection";
import { Heart } from "lucide-react";

export interface GivingModuleProps {
  variant?: "card" | "vipps";
  presentation?: ModulePresentationConfig;
}

export const GivingModule: React.FC<GivingModuleProps> = ({
  variant = "card",
  presentation,
}) => {
  const { settings } = useCms();
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-giving"];
  const defaults = MODULE_PRESENTATION_DEFAULTS["module-giving"];

  const badge = presentationText(config, "badge", defaults.badge);
  const title = presentationText(config, "title", defaults.title);
  const body = presentationText(config, "body", defaults.body);

  if (variant === "vipps") {
    // Without a number there is nothing to give to, so the block is not drawn
    if (!settings.vippsNumber) return null;
    return (
      <PresentationSection
        config={config}
        className="w-full max-w-xl mx-auto px-4 sm:px-6 my-10 text-center space-y-4"
      >
        <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold">
            <Heart className="w-3 h-3" />
            <span>{badge}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-accent-700 font-mono">
            {settings.vippsNumber}
          </div>
          <p className="text-xs text-stone-500">
            Takk for din gave til arbeidet i {settings.churchName}!
          </p>
        </div>
      </PresentationSection>
    );
  }

  return (
    <PresentationSection
      config={config}
      className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 my-12"
    >
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold">
        <Heart className="w-3.5 h-3.5" />
        <span>{badge}</span>
      </div>
      <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-stone-600 max-w-xl mx-auto leading-relaxed">
        {body}
      </p>

      {/* Only the ways of giving the congregation has filled in */}
      {(settings.vippsNumber || settings.bankAccount) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          {settings.vippsNumber && (
            <div className="px-6 py-4 rounded-2xl bg-white border border-stone-200/90 shadow-sm flex items-center gap-4 w-full sm:w-auto justify-center">
              <div className="text-left">
                <div className="text-xs text-stone-500 font-medium">Vipps til nummer</div>
                <div className="text-xl font-black text-accent-700">{settings.vippsNumber}</div>
              </div>
            </div>
          )}

          {settings.bankAccount && (
            <div className="px-6 py-4 rounded-2xl bg-white border border-stone-200/90 shadow-sm flex items-center gap-4 w-full sm:w-auto justify-center">
              <div className="text-left">
                <div className="text-xs text-stone-500 font-medium">Bankkonto for gaver</div>
                <div className="text-base font-mono font-bold text-stone-800">{settings.bankAccount}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </PresentationSection>
  );
};
