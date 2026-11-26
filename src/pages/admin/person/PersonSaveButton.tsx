import { Check, Save } from "lucide-react";
import { studioPrimaryButton } from "../studioDetailTheme";

interface PersonSaveButtonProps {
  justSaved: boolean;
}

// The save button of every tab: it says «Lagret» for a few seconds after a save
export function PersonSaveButton({ justSaved }: PersonSaveButtonProps) {
  return (
    <div className="pt-3">
      <button type="submit" id="btn-save-person-detail" className={studioPrimaryButton}>
        {justSaved ? <Check className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
        {justSaved ? "Lagret" : "Lagre"}
      </button>
    </div>
  );
}
