interface PersonDeleteSectionProps {
  onDelete: () => void;
}

// Deleting the contact: last on the card, where nobody presses it on the way to something else
export function PersonDeleteSection({ onDelete }: PersonDeleteSectionProps) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-xs">
        <p className="font-bold text-red-900">Slett kontakten</p>
        <p className="text-red-800/80">Du får se hva som skjer før noe slettes.</p>
      </div>
      <button
        type="button"
        id="btn-delete-person"
        onClick={() => onDelete()}
        className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold cursor-pointer shrink-0"
      >
        Slett kontakt
      </button>
    </section>
  );
}
