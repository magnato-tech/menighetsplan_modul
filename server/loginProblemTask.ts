// A sign-in that was stopped because its address is not in the register, or because several persons
// share it, is written to the board as a task for the protokollansvarlig (see src/pages/admin/membership).
// One address has at most one open task: a new try on it only counts up the tries and the last time.
// The register is read elsewhere (server/signInEmail.ts and server/loginProblemReport.ts); here the
// task is only written, with the service account, which the database's rules do not stop.

import { randomUUID } from "node:crypto";
import type { InstallationEnv } from "../src/installation";
import type { LoginProblemReason } from "../src/types";
import { loginProblemInstruction } from "../src/utils/membershipClerkTasks";
import { queryDocuments, writeDocumentFields, type Fetch, type RestDatabase } from "./firestoreRest";
import { noticeNewTask } from "./taskNotice";

// The name in src/data/collections.ts, written out here (see emailSending.ts for why)
const MEMBERSHIP_CLERK_TASKS = "membershipClerkTasks";

export interface LoginProblemInput {
  database: RestDatabase;
  /** The address that tried, lower-cased. */
  address: string;
  reason: LoginProblemReason;
  /** The time of the try. */
  now: Date;
  ask: Fetch;
  /** The authorization header of the service account. */
  headers: Record<string, string>;
  env: InstallationEnv;
  /** Where the installation is, "https://menigheten.example". */
  siteUrl: string;
}

/**
 * Records one try with an address that could not sign in: makes the task, or counts the try on the
 * open task of the address. `created` is true only when a new task was made. Never throws; a failure
 * is written to the console without the address.
 */
export async function recordLoginProblem({ database, address, reason, now, ask, headers, env, siteUrl }: LoginProblemInput): Promise<{ created: boolean }> {
  try {
    const at = now.toISOString();
    // Equality on one field only, as the database needs no index for it
    const rows = await queryDocuments(database, MEMBERSHIP_CLERK_TASKS, { field: "loginAddress", op: "EQUAL", value: address }, ask, headers);
    const open = rows.find((row) => row.kind === "loginUnknownEmail" && row.status === "open");
    if (open) {
      const attempts = typeof open.attempts === "number" ? open.attempts : 1;
      await writeDocumentFields(database, `${MEMBERSHIP_CLERK_TASKS}/${open.id}`, { attempts: attempts + 1, lastAttemptAt: at }, ask, headers, true);
      return { created: false };
    }

    const id = `loginproblem-${randomUUID()}`;
    await writeDocumentFields(
      database,
      `${MEMBERSHIP_CLERK_TASKS}/${id}`,
      {
        id,
        kind: "loginUnknownEmail",
        status: "open",
        createdAt: at,
        lastAttemptAt: at,
        attempts: 1,
        loginAddress: address,
        loginReason: reason,
        personId: "",
        personName: "",
        instruction: loginProblemInstruction(address, reason),
      },
      ask,
      headers
    );

    // The notice names no address: the people it goes to see the address on the board
    const summary =
      reason === "shared"
        ? "Noen prøvde å logge inn med en e-postadresse som står på flere personer."
        : "Noen prøvde å logge inn med en e-postadresse som ikke står i registeret.";
    await noticeNewTask({ database, env, ask, headers, now, siteUrl, task: { summary, id } });
    return { created: true };
  } catch (error) {
    console.error("Oppgaven for en innlogging som ble stoppet, fikk ikke blitt lagret:", error instanceof Error ? error.message : error);
    return { created: false };
  }
}
