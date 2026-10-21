import React, { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { removeNewsletterBanner, saveNewsletterBanner } from "../../../../services/newsletter";
import { compressImageFile } from "../../../../utils/imageUpload";
import { uploadStoredImage } from "../../../../services/mediaStorage";
import type { ShowFeedback } from "../../studio";
import { studioCardPadded, studioSecondaryButton } from "../../studioTheme";

interface NewsletterBannerCardProps {
  /** The banner as it is stored, null when there is none, undefined while it is being read. */
  banner: string | null | undefined;
  churchName: string;
  showFeedback: ShowFeedback;
}

/** The banner at the top of every newsletter: uploaded once, here. Without one, the congregation's name stands there. */
export const NewsletterBannerCard: React.FC<NewsletterBannerCardProps> = ({ banner, churchName, showFeedback }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      // Made smaller first, then put in the picture store; the newsletter fetches it from there
      const smaller = await compressImageFile(file, { maxDimension: 1200, quality: 0.85 });
      await saveNewsletterBanner(await uploadStoredImage(smaller, "nyhetsbrev"));
      showFeedback("Toppbildet er lagret.");
    } catch (error) {
      showFeedback(error instanceof Error && error.message ? error.message : "Toppbildet kunne ikke lagres. Prøv igjen.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = () => {
    if (!confirm("Vil du ta bort toppbildet? Nyhetsbrevet får da menighetens navn øverst.")) return;
    removeNewsletterBanner().then(
      () => showFeedback("Toppbildet er tatt bort."),
      () => showFeedback("Toppbildet kunne ikke tas bort. Prøv igjen.", "error")
    );
  };

  return (
    <section aria-label="Toppbilde i nyhetsbrevet" className={`${studioCardPadded} space-y-3`}>
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Toppbilde i nyhetsbrevet</h3>
        <p className="text-[11px] text-[var(--studio-muted)] mt-1">
          Står øverst i hvert nyhetsbrev, for eksempel menighetens logo på en farget flate. Et bredt bilde passer best, omtrent 1200 × 400 punkter. Uten bilde står {churchName} der.
        </p>
      </div>
      {banner === undefined ? (
        <p className="text-xs text-[var(--studio-muted)]">Henter …</p>
      ) : banner ? (
        <img id="newsletter-banner" src={banner} alt="Toppbildet i nyhetsbrevet" className="w-full max-w-md rounded-xl border border-[var(--studio-border)]" />
      ) : (
        <p className="text-xs text-[var(--studio-muted)] italic">Ingen toppbilde er lastet opp.</p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Velg toppbilde" onChange={(event) => void upload(event.target.files?.[0])} />
        <button type="button" disabled={busy || banner === undefined} onClick={() => input.current?.click()} className={`${studioSecondaryButton} flex items-center justify-center gap-1.5 disabled:opacity-50`}>
          <ImagePlus className="w-4 h-4" aria-hidden="true" />
          <span>{busy ? "Lagrer …" : banner ? "Bytt toppbilde" : "Last opp toppbilde"}</span>
        </button>
        {banner && (
          <button type="button" onClick={remove} className={`${studioSecondaryButton} flex items-center justify-center gap-1.5`}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>Ta bort</span>
          </button>
        )}
      </div>
    </section>
  );
};
