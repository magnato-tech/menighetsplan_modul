import { membershipClerkMayOpen } from "./membershipClerk";
import type { StudioTab } from "./studio";
import { webEditorMayOpen } from "./webEditor";

// Which tabs of the admin a person may open. Four ways in: an administrator has all of them; a web editor has
// the website part (webEditor.ts); a membership clerk has the register's board (membershipClerk.ts); and a person
// with a right in givertjeneste has the tab for it, and the help. Someone who gets in only by a giving right
// has nothing else.

export interface TabWho {
  isAdmin: boolean;
  /** A web editor who is not an administrator. */
  webEditor: boolean;
  /** A membership clerk who is neither an administrator nor a web editor. */
  clerk: boolean;
  /** Holds at least one right in givertjeneste (see utils/giving/access.ts). */
  giving: boolean;
}

export function mayOpenTab(tab: StudioTab, who: TabWho): boolean {
  // The page for the rights shows its own explanation to an administrator without a right
  if (tab === "giver-innstillinger") return who.isAdmin || who.giving;
  // The gift purposes and the sign-ins are the administrator's alone
  if (tab === "gaveformal" || tab === "innlogging") return who.isAdmin;
  if (who.isAdmin) return true;
  return (
    (who.webEditor && webEditorMayOpen(tab)) ||
    (who.clerk && membershipClerkMayOpen(tab)) ||
    (who.giving && tab === "cms-hjelp")
  );
}
