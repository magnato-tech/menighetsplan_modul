import React from "react";
import { VisualBlock } from "../../utils/cmsBlocks";
import { readSectionAnchor, stripSectionAnchorComment } from "../../utils/cmsLinks";
import { readModulePresentation } from "../../utils/modulePresentation";
import { blockPeriodLabel, blockPeriodState, type BlockSettings, type BlockSpacing } from "../../utils/blockSettings";
import { CmsContentRenderer } from "./CmsContentRenderer";
import { WorshipModule } from "./modules/WorshipModule";
import { CalendarModule } from "./modules/CalendarModule";
import { KalenderModule } from "./modules/KalenderModule";
import { NewsModule } from "./modules/NewsModule";
import { SermonModule } from "./modules/SermonModule";
import { GroupsModule } from "./modules/GroupsModule";
import { GivingModule } from "./modules/GivingModule";

interface VisualBlockFlowProps {
  blocks: VisualBlock[];
  /** Static pages already sit in a narrow column, so text blocks skip the extra page gutter. */
  embed?: boolean;
  /** The editor's live preview shows blocks outside their period too, marked as not visible now. */
  preview?: boolean;
}

const SPACING_WITH_BACKGROUND: Record<BlockSpacing, string> = {
  normal: "py-12",
  liten: "py-6",
  ingen: "py-0",
};

// Without a background, spacing moves the wrapper margin, since the flow already adds space between blocks.
const SPACING_AS_MARGIN: Record<Exclude<BlockSpacing, "normal">, string> = {
  liten: "-my-3",
  ingen: "-my-6",
};

const WHITE_TEXT_CLASSES =
  "text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_p]:text-white [&_li]:text-white";

/** Quotes and brackets would break the url(...) in the style, so they are percent-encoded. */
const safeCssUrl = (url: string) => url.replace(/["'()\\\s]/g, (char) => encodeURIComponent(char));

function hasLook(settings?: BlockSettings): settings is BlockSettings {
  return Boolean(settings && (settings.bakgrunn || settings.bakgrunnsbilde || settings.hvitTekst || settings.luft));
}

/** Background, text colour and spacing for the wrapper around one block. */
function lookOf(settings: BlockSettings): { className: string; style: React.CSSProperties } {
  const classes: string[] = [];
  const style: React.CSSProperties = {};
  const luft = settings.luft ?? "normal";
  const hasBackground = Boolean(settings.bakgrunn || settings.bakgrunnsbilde);

  if (settings.bakgrunnsbilde) {
    // The dark overlay keeps white and dark text readable on any picture
    style.backgroundImage = `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${safeCssUrl(settings.bakgrunnsbilde)}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (settings.bakgrunn) {
    style.backgroundColor = settings.bakgrunn;
  }

  if (hasBackground) {
    classes.push(SPACING_WITH_BACKGROUND[luft]);
  } else if (luft !== "normal") {
    classes.push(SPACING_AS_MARGIN[luft]);
  }

  if (settings.hvitTekst) classes.push(WHITE_TEXT_CLASSES);
  return { className: classes.join(" "), style };
}

function BlockBody({ block, embed }: { block: VisualBlock; embed: boolean }) {
  const presentation =
    block.type.startsWith("module-") ? readModulePresentation(block) : undefined;

  switch (block.type) {
    case "module-worship":
      return (
        <WorshipModule
          variant={block.variant as "highlight" | "compact"}
          presentation={presentation}
        />
      );
    case "module-calendar":
      return <CalendarModule presentation={presentation} />;
    case "module-kalender":
      return (
        <KalenderModule
          variant={block.variant as "month" | "list"}
          presentation={presentation}
        />
      );
    case "module-news":
      return (
        <NewsModule
          variant={block.variant as "grid" | "compact"}
          presentation={presentation}
        />
      );
    case "module-sermon":
      return (
        <SermonModule
          variant={block.variant as "player" | "minimal"}
          presentation={presentation}
        />
      );
    case "module-groups":
      return (
        <GroupsModule
          variant={block.variant as "banner" | "cards"}
          presentation={presentation}
        />
      );
    case "module-giving":
      return (
        <GivingModule
          variant={block.variant as "card" | "vipps"}
          presentation={presentation}
        />
      );
    case "person-grid":
      return <CmsContentRenderer content={`:::personer[${block.variant || "alle"}]\n:::`} />;
    default: {
      const content = stripSectionAnchorComment(block.rawContent || "");
      const body = <CmsContentRenderer content={content} />;
      if (embed) return body;
      return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6">{body}</div>;
    }
  }
}

export const VisualBlockFlow: React.FC<VisualBlockFlowProps> = ({ blocks, embed = false, preview = false }) => {
  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        if (block.hidden) return null;
        // Outside its period a block is only shown in the editor's preview, faded and marked
        const period = blockPeriodState(block.settings);
        const isActive = period === "active";
        if (!isActive && !preview) return null;

        const sectionAnchor = readSectionAnchor(block);
        const body = <BlockBody block={block} embed={embed} />;
        const look = hasLook(block.settings) ? lookOf(block.settings) : null;
        const content = look ? (
          <section data-block-look className={look.className} style={look.style}>
            {body}
          </section>
        ) : (
          body
        );

        return (
          <div
            key={block.id || idx}
            id={sectionAnchor || undefined}
            data-cms-block={block.type}
            data-cms-variant={block.variant || ""}
            data-cms-preview-target={block.id || `block-${idx}`}
          >
            {!isActive && (
              <p
                data-block-period-note
                className="mb-2 inline-block rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white"
              >
                {`Vises ${blockPeriodLabel(block.settings) ?? ""} – ikke synlig nå`}
              </p>
            )}
            {isActive ? content : <div className="opacity-50">{content}</div>}
          </div>
        );
      })}
    </div>
  );
};
