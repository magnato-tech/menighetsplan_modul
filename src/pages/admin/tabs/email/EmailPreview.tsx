import React, { useMemo } from "react";
import { TEST_UNSUBSCRIBE_TOKEN, unsubscribeUrlOf } from "../../../../utils/newsletter";
import { renderEmail, type EmailDraft } from "../../../../utils/emailMessage";
import { studioCardPadded, studioSecondaryButton } from "../../studioTheme";

interface EmailPreviewProps {
  draft: EmailDraft;
  churchName: string;
  /** The newsletter has the banner and the link to unsubscribe. */
  newsletter: boolean;
  banner: string | null | undefined;
  loginLink: boolean;
  /** The day the login links work through, when they are on and valid. */
  loginLinkUntil?: string;
  onBack: () => void;
}

/** The e-mail as the recipients will see it, in a frame. Opened by «Forhåndsvis». */
export const EmailPreview: React.FC<EmailPreviewProps> = ({ draft, churchName, newsletter, banner, loginLink, loginLinkUntil, onBack }) => {
  const preview = useMemo(
    () =>
      renderEmail({
        draft,
        churchName,
        siteUrl: window.location.origin,
        firstName: "Kari",
        ...(newsletter ? { newsletter: { unsubscribeUrl: unsubscribeUrlOf(window.location.origin, TEST_UNSUBSCRIBE_TOKEN), bannerUrl: banner ?? null } } : {}),
        ...(loginLink ? { loginLink: true, ...(loginLinkUntil ? { loginLinkUntil } : {}) } : {}),
      }),
    [draft, churchName, newsletter, banner, loginLink, loginLinkUntil]
  );

  return (
    <section aria-label="Slik ser den ut" className={`${studioCardPadded} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Slik ser den ut</h3>
        <button type="button" onClick={onBack} className={studioSecondaryButton}>
          ← Tilbake til skriving
        </button>
      </div>
      <dl className="text-[11px] text-[var(--studio-muted)] space-y-0.5">
        <div>
          <dt className="inline font-bold">Fra: </dt>
          <dd className="inline">{churchName}</dd>
        </div>
        <div>
          <dt className="inline font-bold">Emne: </dt>
          <dd className="inline text-[var(--studio-text)]">{preview.subject || "–"}</dd>
        </div>
      </dl>
      <iframe
        id="email-preview"
        title="Slik ser e-posten ut"
        srcDoc={preview.html}
        // No scripts can run in it; the same origin only lets the browser draw it as a frame of the page
        sandbox="allow-same-origin"
        className="w-full h-[560px] rounded-xl bg-white border border-[var(--studio-border)]"
      />
      <p className="text-[11px] text-[var(--studio-muted)]">
        {newsletter ? "Lenkene virker ikke her, bare i e-posten." : "«Kari» står her for fornavnet til den som får e-posten. Lenkene virker ikke her, bare i e-posten."}
      </p>
    </section>
  );
};
