import React, { useEffect, useRef, useState } from "react";
import {
  VisualBlock,
  DYNAMIC_MODULES_META,
  DynamicModuleType,
  PERSON_GRID_VARIANTS,
  StaticBlockFields,
  readStaticFields,
  applyStaticFields,
  staticPreviewText,
  shortenHeading,
} from "../../../../utils/cmsBlocks";
import {
  applyModulePresentation,
  isEditableDynamicModule,
  ModulePresentationConfig,
  readModulePresentation,
} from "../../../../utils/modulePresentation";
import { ModulePresentationEditor } from "../../../../components/admin/ModulePresentationEditor";
import { CmsMediaPicker } from "../../../../components/admin/CmsMediaPicker";
import { CmsLinkPicker } from "../../../../components/admin/CmsLinkPicker";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Edit3,
  Check,
  Calendar,
  Layers,
  Sparkles,
  LayoutGrid,
  FileText,
  Quote,
  Image,
  Info,
  Users,
  Heart,
  Headphones,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";

interface VisualBlockManagerProps {
  blocks: VisualBlock[];
  onChange: (blocks: VisualBlock[]) => void;
  onOpenBlockPicker: () => void;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  currentPageId?: string;
  /** A section pressed in the preview: its fields are opened, and on an event's card, also the event. */
  openRequest?: { blockId: string; gatheringId?: string; nonce: number } | null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(
    target &&
      (target as HTMLElement).closest("button, select, textarea, input, a, label, option")
  );
}

/** How long after the last change in a module's fields the preview follows. */
export const LIVE_APPLY_MS = 500;

export const VisualBlockManager: React.FC<VisualBlockManagerProps> = ({
  blocks,
  onChange,
  onOpenBlockPicker,
  selectedBlockId,
  onSelectBlock,
  currentPageId,
  openRequest,
}) => {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<StaticBlockFields | null>(null);
  const [moduleEditConfig, setModuleEditConfig] = useState<ModulePresentationConfig | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  // The event to open in «Hva skjer», when its card was pressed in the preview
  const [openEvent, setOpenEvent] = useState<{ id: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!openRequest) return;
    const block = blocks.find((candidate) => candidate.id === openRequest.blockId);
    if (!block || !canEditBlockContent(block)) return;
    if (editingBlockId !== block.id) handleStartEditContent(block);
    setOpenEvent(openRequest.gatheringId ? { id: openRequest.gatheringId, nonce: openRequest.nonce } : null);
  }, [openRequest?.nonce]);

  // The blocks as they stand when a change below is applied, not as they stood when it was typed
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // A change in a module's fields shows in the preview half a second after the last keystroke,
  // without «Bruk endringer». The fields stay open; «Ferdig» or «Bruk endringer» closes them.
  useEffect(() => {
    if (!editingBlockId || !moduleEditConfig) return;
    const timer = window.setTimeout(() => {
      const current = blocksRef.current;
      const index = current.findIndex((block) => block.id === editingBlockId);
      if (index < 0) return;
      const applied = applyModulePresentation(current[index], moduleEditConfig);
      if (applied.rawContent === current[index].rawContent) return;
      const next = [...current];
      next[index] = applied;
      onChange(next);
    }, LIVE_APPLY_MS);
    return () => window.clearTimeout(timer);
  }, [moduleEditConfig, editingBlockId]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...blocks];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= blocks.length - 1) return;
    const next = [...blocks];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleToggleHide = (index: number) => {
    const next = [...blocks];
    next[index] = {
      ...next[index],
      hidden: !next[index].hidden,
    };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    const next = blocks.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleVariantChange = (index: number, variant: string) => {
    const next = [...blocks];
    const personLabel = PERSON_GRID_VARIANTS.find((item) => item.id === variant)?.label;
    next[index] = {
      ...next[index],
      variant,
      title: next[index].type === "person-grid" && personLabel ? personLabel : next[index].title,
    };
    onChange(next);
  };

  const canEditBlockContent = (block: VisualBlock) =>
    !block.isDynamic || isEditableDynamicModule(block.type);

  const handleStartEditContent = (block: VisualBlock) => {
    setEditingBlockId(block.id);
    if (isEditableDynamicModule(block.type)) {
      setEditFields(null);
      setModuleEditConfig(readModulePresentation(block));
    } else {
      setModuleEditConfig(null);
      setEditFields(readStaticFields(block));
    }
    onSelectBlock?.(block.id);
  };

  const handleSaveEditContent = (index: number) => {
    const block = blocks[index];
    const next = [...blocks];
    if (isEditableDynamicModule(block.type) && moduleEditConfig) {
      next[index] = applyModulePresentation(block, moduleEditConfig);
    } else if (editFields) {
      next[index] = applyStaticFields(block, editFields);
    } else {
      return;
    }
    onChange(next);
    setEditingBlockId(null);
    setEditFields(null);
    setModuleEditConfig(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const next = [...blocks];
    const [movedBlock] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, movedBlock);

    onChange(next);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getModuleIcon = (type: string) => {
    switch (type) {
      case "module-worship":
        return <Calendar className="w-4 h-4 text-amber-400" />;
      case "module-calendar":
        return <Calendar className="w-4 h-4 text-sky-400" />;
      case "module-kalender":
        return <Calendar className="w-4 h-4 text-primary-400" />;
      case "module-news":
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case "module-sermon":
        return <Headphones className="w-4 h-4 text-pink-400" />;
      case "module-groups":
        return <Users className="w-4 h-4 text-[var(--studio-icon)]" />;
      case "module-giving":
        return <Heart className="w-4 h-4 text-rose-400" />;
      case "grid":
        return <LayoutGrid className="w-4 h-4 text-emerald-400" />;
      case "media-left":
      case "media-right":
        return <Image className="w-4 h-4 text-[var(--studio-icon)]" />;
      case "quote":
        return <Quote className="w-4 h-4 text-amber-400" />;
      case "callout":
        return <Info className="w-4 h-4 text-sky-400" />;
      case "person-grid":
        return <Users className="w-4 h-4 text-primary-400" />;
      default:
        return <FileText className="w-4 h-4 text-[var(--studio-muted)]" />;
    }
  };

  return (
    <div className="space-y-3" data-cms-surface="editor">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--studio-icon)]" />
          <h4 className="text-xs font-bold text-[var(--studio-text)] uppercase tracking-wider">
            Innholdsblokker & Moduler på siden
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--studio-muted)]">
          <span>⠿ Dra & slipp for å endre rekkefølge</span>
          <span>·</span>
          <span>
            {blocks.filter((b) => !b.hidden).length} synlige av {blocks.length}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {blocks.map((block, index) => {
          const isDynamic = block.isDynamic;
          const isHidden = block.hidden === true;
          const dynamicMeta = isDynamic
            ? DYNAMIC_MODULES_META[block.type as DynamicModuleType]
            : null;
          const isEditing = editingBlockId === block.id;
          const isBeingDragged = draggedIndex === index;
          const isDragTarget = dragOverIndex === index;
          const isSelected = selectedBlockId === block.id;
          const displayTitle = shortenHeading(block.title, 48);

          return (
            <div
              key={block.id || index}
              draggable={!isEditing}
              onClick={(e) => {
                if (isInteractiveTarget(e.target)) return;
                onSelectBlock?.(block.id);
              }}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              data-cms-block={block.type}
              data-cms-variant={block.variant || ""}
              data-cms-hidden={isHidden ? "true" : "false"}
              data-cms-editor-target={block.id}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected ? "ring-2 ring-indigo-400 border-indigo-500" : ""
              } ${isDragTarget ? "border-indigo-400 ring-2 ring-indigo-500/50 bg-[var(--studio-surface)]" : ""} ${
                isBeingDragged ? "opacity-40" : ""
              } ${
                isHidden
                  ? "bg-[var(--studio-panel-bg)]/70 border-dashed border-[var(--studio-border)] opacity-60"
                  : isDynamic
                  ? "bg-[var(--studio-input)] border-indigo-700/60 hover:border-indigo-500 shadow-sm"
                  : "bg-[var(--studio-row)] border-[var(--studio-border)] hover:border-[var(--studio-border)]"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className="p-1 cursor-grab active:cursor-grabbing text-[var(--studio-muted)] hover:text-[var(--studio-muted)] mt-1 shrink-0"
                    title="Klikk og dra for å flytte blokk"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isDynamic
                        ? "bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)]"
                        : "bg-[var(--studio-surface)] border border-[var(--studio-border)]"
                    }`}
                  >
                    {getModuleIcon(block.type)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-bold text-xs ${isHidden ? "line-through text-[var(--studio-muted)]" : "text-[var(--studio-text)]"}`}
                        title={block.title}
                      >
                        {displayTitle}
                      </span>

                      {isHidden && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-700 text-amber-300 flex items-center gap-1">
                          <EyeOff className="w-2.5 h-2.5 text-amber-400" />
                          <span>Skjult på nettsiden</span>
                        </span>
                      )}

                      {isDynamic ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 border border-indigo-700 text-[var(--studio-accent-text)] flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-[var(--studio-icon)]" />
                          <span>⚡ Dynamisk modul</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--studio-surface)] border border-[var(--studio-border)] text-emerald-300">
                          📝 Statisk innhold
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--studio-muted)] leading-snug line-clamp-2">
                      {isDynamic && dynamicMeta
                        ? `Datakilde: ${dynamicMeta.dataSource}`
                        : block.type === "person-grid"
                        ? "Datakilde: Personregisteret"
                        : `«${staticPreviewText(block)}»`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-9">
                  {/* Layout variant dropdown for dynamic modules */}
                  {isDynamic && (dynamicMeta?.supportedVariants || block.type === "person-grid") && (
                    <div className="flex items-center gap-1.5 bg-[var(--studio-panel-bg)] px-2 py-1 rounded-lg border border-[var(--studio-border)]">
                      <span className="text-[10px] text-[var(--studio-muted)] hidden xl:inline">Visning:</span>
                      <select
                        value={block.variant || (dynamicMeta?.supportedVariants || personVariants(block.variant))[0].id}
                        onChange={(e) => handleVariantChange(index, e.target.value)}
                        className="bg-transparent text-[var(--studio-accent-text)] text-xs font-semibold focus:outline-hidden cursor-pointer"
                        title="Velg godkjent layoutvariant for denne modulen"
                      >
                        {(dynamicMeta?.supportedVariants || personVariants(block.variant)).map((v) => (
                          <option key={v.id} value={v.id} className="bg-[var(--studio-bg)] text-[var(--studio-input-text)]">
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Edit button for static content and groups module presentation */}
                  {canEditBlockContent(block) && (
                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? handleSaveEditContent(index)
                          : handleStartEditContent(block)
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        isEditing
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                          : "bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-slate-200 border-[var(--studio-border)]"
                      }`}
                      title={isEditing ? "Ferdig med redigering" : "Rediger innhold"}
                    >
                      {isEditing ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Ferdig</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                          <span>Rediger innhold</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Vis / Skjul toggle button */}
                  <button
                    type="button"
                    onClick={() => handleToggleHide(index)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                      isHidden
                        ? "bg-amber-950/70 border-amber-700 text-amber-300 hover:bg-amber-900"
                        : "bg-[var(--studio-surface)] border-[var(--studio-border)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"
                    }`}
                    title={isHidden ? "Gjør blokken synlig på nettsiden" : "Skjul blokken midlertidig"}
                    aria-label={isHidden ? "Vis blokk" : "Skjul blokk"}
                  >
                    {isHidden ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                  </button>

                  {/* Up button */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="p-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] disabled:opacity-30 disabled:hover:bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] transition-colors cursor-pointer"
                    title="Flytt opp"
                    aria-label="Flytt opp"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>

                  {/* Down button */}
                  <button
                    type="button"
                    disabled={index === blocks.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="p-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] disabled:opacity-30 disabled:hover:bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] transition-colors cursor-pointer"
                    title="Flytt ned"
                    aria-label="Flytt ned"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-rose-950 text-[var(--studio-muted)] hover:text-rose-400 border border-transparent hover:border-rose-800/80 transition-colors cursor-pointer"
                    title="Fjern blokk permanent fra siden"
                    aria-label="Fjern blokk"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline editor when expanding a static block */}
              {isEditing && isEditableDynamicModule(block.type) && moduleEditConfig && (
                <ModulePresentationEditor
                  moduleType={block.type as DynamicModuleType}
                  config={moduleEditConfig}
                  openEvent={openEvent}
                  currentPageId={currentPageId}
                  onChange={(next) => {
                    setModuleEditConfig(next);
                    onSelectBlock?.(block.id);
                  }}
                  onSave={() => handleSaveEditContent(index)}
                  dataSourceNote={
                    block.type.startsWith("module-")
                      ? `Arrangement, artikler og tall hentes fra ${DYNAMIC_MODULES_META[block.type as DynamicModuleType]?.dataSource}. Feltene over styrrer bare tekst og utseende på modulen.`
                      : undefined
                  }
                />
              )}
              {isEditing && !isEditableDynamicModule(block.type) && editFields && (
                <StaticBlockEditor
                  block={block}
                  fields={editFields}
                  currentPageId={currentPageId}
                  onChange={(next) => {
                    setEditFields(next);
                    onSelectBlock?.(block.id);
                  }}
                  onSave={() => handleSaveEditContent(index)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Button to add new block */}
      <button
        type="button"
        onClick={onOpenBlockPicker}
        className="w-full py-3 px-4 rounded-xl border border-dashed border-indigo-700/80 hover:border-indigo-500 bg-[var(--studio-accent-bg)] hover:bg-[var(--studio-accent-bg)] text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
      >
        <Plus className="w-4 h-4 text-[var(--studio-icon)]" />
        <span>Legg til blokk eller modul</span>
      </button>
    </div>
  );
};

function personVariants(current?: string) {
  if (current && !PERSON_GRID_VARIANTS.some((variant) => variant.id === current)) {
    return [...PERSON_GRID_VARIANTS, { id: current, label: current }];
  }
  return PERSON_GRID_VARIANTS;
}

const fieldClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500";

function StaticBlockEditor({
  block,
  fields,
  currentPageId,
  onChange,
  onSave,
}: {
  block: VisualBlock;
  fields: StaticBlockFields;
  currentPageId?: string;
  onChange: (fields: StaticBlockFields) => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<StaticBlockFields>) => onChange({ ...fields, ...patch });

  return (
    <div className="mt-3 pt-3 border-t border-[var(--studio-border)] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--studio-muted)]">Rediger innhold</span>
        <button
          type="button"
          onClick={onSave}
          className="text-[11px] text-[var(--studio-icon)] hover:text-[var(--studio-accent-text)] font-medium cursor-pointer"
        >
          Bruk endringer
        </button>
      </div>

      {block.type === "cta" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="space-y-1 block">
            <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Knappetekst</span>
            <input className={fieldClass} value={fields.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} />
          </label>
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-[var(--studio-muted)] block">Lenke</span>
            <CmsLinkPicker
              value={fields.ctaUrl}
              onChange={(ctaUrl) => set({ ctaUrl })}
              currentPageId={currentPageId}
              allowEmpty
              emptyLabel="Ingen lenke"
            />
          </div>
        </div>
      ) : block.type === "quote" ? (
        <div className="space-y-2">
          <label className="space-y-1 block">
            <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Sitat</span>
            <textarea rows={3} className={fieldClass} value={fields.body} onChange={(e) => set({ body: e.target.value })} />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Kilde</span>
            <input className={fieldClass} value={fields.author} onChange={(e) => set({ author: e.target.value })} />
          </label>
        </div>
      ) : block.type === "grid" ? (
        <div className="space-y-2">
          {fields.cards.map((card, cardIndex) => (
            <div key={cardIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-lg border border-[var(--studio-border)]">
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Kort {cardIndex + 1}: tittel</span>
                <input
                  className={fieldClass}
                  value={card.title}
                  onChange={(e) => {
                    const cards = fields.cards.map((item, i) => (i === cardIndex ? { ...item, title: e.target.value } : item));
                    set({ cards });
                  }}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Tekst</span>
                <textarea
                  rows={2}
                  className={fieldClass}
                  value={card.body}
                  onChange={(e) => {
                    const cards = fields.cards.map((item, i) => (i === cardIndex ? { ...item, body: e.target.value } : item));
                    set({ cards });
                  }}
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ cards: [...fields.cards, { title: "", body: "" }] })}
            className="text-[11px] font-semibold text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] cursor-pointer"
          >
            Legg til kort
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {(block.type === "media-left" || block.type === "media-right") && (
            <>
              <CmsMediaPicker
                label="Bilde"
                value={fields.imageUrl}
                onChange={(url) => set({ imageUrl: url })}
              />
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold text-[var(--studio-muted)]">
                  Alt-tekst (valgfri overstyring)
                </span>
                <input
                  className={fieldClass}
                  value={fields.imageAlt}
                  onChange={(e) => set({ imageAlt: e.target.value })}
                  placeholder="Tom = standardtekst fra biblioteket"
                />
              </label>
            </>
          )}
          {block.type === "callout" && (
            <label className="space-y-1 block">
              <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Type</span>
              <select className={fieldClass} value={fields.tone} onChange={(e) => set({ tone: e.target.value })}>
                <option value="info">Informasjon</option>
                <option value="warning">Viktig</option>
                <option value="success">Tips</option>
                <option value="primary">Fremhevet</option>
              </select>
            </label>
          )}
          <label className="space-y-1 block">
            <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Tittel</span>
            <input className={fieldClass} value={fields.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Tekst</span>
            <textarea rows={4} className={fieldClass} value={fields.body} onChange={(e) => set({ body: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
