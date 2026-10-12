import { useEffect, useRef, useState } from "react";
import {
  clearWithdrawalReasons,
  patchAssignmentAccess,
  deleteMemberProposals,
  storeGatheringReaderChanges,
  subscribeMemberProposals,
  storeGroupDirectoryChanges,
  storeGroupLeaderEmailChanges,
  storeLoginChanges,
  storePublicGroupCardChanges,
  storePublicProfileChanges,
  subscribeGatheringReaders,
  subscribeGroupDirectory,
  subscribeGroupLeaderEmails,
  subscribeLogins,
  subscribePublicGroupCards,
  subscribePublicProfiles,
} from "../services/registerMirror";
import type { Assignment, Gathering, Group, MemberProposal, Person, Task } from "../types";
import { idsWithWithdrawalReason } from "../utils/staffing";
import {
  assignmentAccessPatches,
  gatheringReadersOf,
  groupDirectoryOf,
  groupLeaderEmailsOf,
  publicGroupCardsOf,
  type GatheringReader,
  type GroupDirectoryCard,
  type GroupLeaderEmail,
  type PublicGroupCard,
} from "../utils/groupAccess";
import { keepingOwnLogin, loginsOf, type Login } from "../utils/logins";
import { proposalIdsToForget } from "../utils/memberProposals";
import { hasChanges, mirrorChanges } from "../utils/mirror";
import { publicCopiesOf } from "../utils/publicProfile";

export interface RegisterMirrorPlanning {
  groups: Group[];
  gatherings: Gathering[];
  tasks: Task[];
  assignments: Assignment[];
  /** Whether the groups have arrived, so the directory is not written from an empty list. */
  listsReady: boolean;
  /** Whether tasks and assignments have arrived. On the public website they are not loaded. */
  planningReady: boolean;
}

/**
 * Keeps what follows from the register in step with it, from the browser of an administrator
 * who has the app open: the logins, the public copies, the group directory, the leaders'
 * e-mail cards, the public group cards, and the names on the assignments.
 *
 * `active` is whether the one at the screen is an administrator and the whole register has
 * arrived. Nothing is written from a register that is only half there. The group lists wait
 * until the planning has arrived too, so an empty list is not written over what is stored.
 */
export function useRegisterMirror(
  persons: Person[],
  active: boolean,
  ownEmail: string | null,
  planning: RegisterMirrorPlanning = { groups: [], gatherings: [], tasks: [], assignments: [], listsReady: false, planningReady: false }
): void {
  const [logins, setLogins] = useState<Login[] | null>(null);
  const [copies, setCopies] = useState<Person[] | null>(null);
  const [directory, setDirectory] = useState<GroupDirectoryCard[] | null>(null);
  const [emails, setEmails] = useState<GroupLeaderEmail[] | null>(null);
  const [cards, setCards] = useState<PublicGroupCard[] | null>(null);
  const [readers, setReaders] = useState<GatheringReader[] | null>(null);
  const [proposals, setProposals] = useState<MemberProposal[] | null>(null);
  // Each mirror stops on its own. A refusal of one write must not leave the others unwritten.
  const stopped = useRef({ logins: false, copies: false, directory: false, emails: false, cards: false, readers: false, assignments: false, proposals: false, reasons: false });

  useEffect(() => {
    if (!active) return;
    stopped.current = { logins: false, copies: false, directory: false, emails: false, cards: false, readers: false, assignments: false, proposals: false, reasons: false };
    const unsubscribers = [
      subscribeLogins((list, settled) => setLogins(settled ? list : null)),
      subscribePublicProfiles((list, settled) => setCopies(settled ? list : null)),
      subscribeGroupDirectory((list, settled) => setDirectory(settled ? list : null)),
      subscribeGroupLeaderEmails((list, settled) => setEmails(settled ? list : null)),
      subscribePublicGroupCards((list, settled) => setCards(settled ? list : null)),
      subscribeGatheringReaders((list, settled) => setReaders(settled ? list : null)),
      subscribeMemberProposals((list, settled) => setProposals(settled ? list : null)),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      setLogins(null);
      setCopies(null);
      setDirectory(null);
      setEmails(null);
      setCards(null);
      setReaders(null);
      setProposals(null);
    };
  }, [active]);

  const fail = (part: keyof typeof stopped.current, what: string) => (error: unknown) => {
    stopped.current[part] = true;
    console.warn(`${what} kunne ikke oppdateres etter registeret:`, error);
  };

  useEffect(() => {
    if (!active || stopped.current.logins || logins === null) return;
    const changes = keepingOwnLogin(mirrorChanges(loginsOf(persons), logins), ownEmail);
    if (!hasChanges(changes)) return;
    storeLoginChanges(changes).catch(fail("logins", "Innloggingene"));
  }, [active, persons, logins, ownEmail]);

  useEffect(() => {
    if (!active || stopped.current.copies || copies === null) return;
    const changes = mirrorChanges(publicCopiesOf(persons), copies);
    if (!hasChanges(changes)) return;
    storePublicProfileChanges(changes).catch(fail("copies", "De offentlige profilene"));
  }, [active, persons, copies]);

  useEffect(() => {
    if (!active || !planning.listsReady || stopped.current.directory || directory === null) return;
    const changes = mirrorChanges(groupDirectoryOf(persons, planning.groups), directory);
    if (!hasChanges(changes)) return;
    storeGroupDirectoryChanges(changes).catch(fail("directory", "Gruppekatalogen"));
  }, [active, planning.listsReady, planning.groups, persons, directory]);

  useEffect(() => {
    if (!active || !planning.listsReady || stopped.current.emails || emails === null) return;
    const changes = mirrorChanges(groupLeaderEmailsOf(persons, planning.groups), emails);
    if (!hasChanges(changes)) return;
    storeGroupLeaderEmailChanges(changes).catch(fail("emails", "E-postkortene"));
  }, [active, planning.listsReady, planning.groups, persons, emails]);

  useEffect(() => {
    if (!active || !planning.listsReady || stopped.current.cards || cards === null) return;
    const changes = mirrorChanges(publicGroupCardsOf(planning.groups, persons), cards);
    if (!hasChanges(changes)) return;
    storePublicGroupCardChanges(changes).catch(fail("cards", "De offentlige gruppekortene"));
  }, [active, planning.listsReady, planning.groups, persons, cards]);

  useEffect(() => {
    if (!active || !planning.planningReady || stopped.current.readers || readers === null) return;
    const changes = mirrorChanges(
      gatheringReadersOf(planning.gatherings, planning.groups, planning.tasks, planning.assignments),
      readers
    );
    if (!hasChanges(changes)) return;
    storeGatheringReaderChanges(changes).catch(fail("readers", "Lesemerkene"));
  }, [active, planning.planningReady, planning.gatherings, planning.groups, planning.tasks, planning.assignments, readers]);

  useEffect(() => {
    if (!active || !planning.planningReady || stopped.current.assignments) return;
    const patches = assignmentAccessPatches(planning.assignments, planning.tasks, planning.gatherings, persons);
    if (patches.length === 0) return;
    patchAssignmentAccess(patches).catch(fail("assignments", "Navnene på tildelingene"));
  }, [active, planning.planningReady, planning.assignments, planning.tasks, planning.gatherings, persons]);

  useEffect(() => {
    if (!active || stopped.current.proposals || proposals === null) return;
    const ids = proposalIdsToForget(proposals);
    if (ids.length === 0) return;
    deleteMemberProposals(ids).catch(fail("proposals", "Gamle forslag"));
  }, [active, proposals]);

  useEffect(() => {
    if (!active || !planning.planningReady || stopped.current.reasons) return;
    const ids = idsWithWithdrawalReason(planning.assignments);
    if (ids.length === 0) return;
    clearWithdrawalReasons(ids).catch(fail("reasons", "Forfallsgrunnene"));
  }, [active, planning.planningReady, planning.assignments]);
}
