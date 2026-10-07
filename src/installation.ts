// Which database this installation of the app belongs to.
//
// Every congregation has its own installation with its own Firebase project, so nothing about a
// project is written in the code. It comes from the settings of the installation: VITE_FIREBASE_*
// where the installation is hosted, or .env.local on a developer's machine (see .env.example).
// The browser, the server (server.ts) and the scripts all read the same names through this file.

export interface InstallationConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  /** A named Firestore database. Left out for the default database, which a new project has. */
  firestoreDatabaseId?: string;
  /** What the vendor calls the installation, usually the congregation's short name. */
  tenantId?: string;
}

/** The settings an installation cannot run without, and the name each is given by. */
export const REQUIRED_SETTINGS = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  appId: "VITE_FIREBASE_APP_ID",
} as const;

export const OPTIONAL_SETTINGS = {
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  firestoreDatabaseId: "VITE_FIREBASE_DATABASE_ID",
  tenantId: "VITE_TENANT_ID",
} as const;

/** Settings as they are given: `import.meta.env` in the browser, `process.env` on the server. */
export type InstallationEnv = Record<string, unknown>;

const valueOf = (env: InstallationEnv, name: string): string | undefined => {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

/** The names of the required settings that are missing or empty, in the order they are listed. */
export function missingInstallationSettings(env: InstallationEnv): string[] {
  return Object.values(REQUIRED_SETTINGS).filter((name) => valueOf(env, name) === undefined);
}

/** The installation's settings, or null when a required one is missing. Never a guess at another project. */
export function readInstallationConfig(env: InstallationEnv): InstallationConfig | null {
  if (missingInstallationSettings(env).length > 0) return null;
  const config: InstallationConfig = {
    apiKey: valueOf(env, REQUIRED_SETTINGS.apiKey)!,
    authDomain: valueOf(env, REQUIRED_SETTINGS.authDomain)!,
    projectId: valueOf(env, REQUIRED_SETTINGS.projectId)!,
    appId: valueOf(env, REQUIRED_SETTINGS.appId)!,
  };
  for (const [key, name] of Object.entries(OPTIONAL_SETTINGS) as [keyof typeof OPTIONAL_SETTINGS, string][]) {
    const value = valueOf(env, name);
    if (value !== undefined) config[key] = value;
  }
  return config;
}

/** What Firebase itself is started with: the settings without the ones that are ours. */
export function firebaseOptionsOf(config: InstallationConfig) {
  const { firestoreDatabaseId: _database, tenantId: _tenant, ...options } = config;
  return options;
}

/**
 * Stands in where an installation has no settings, so that the code can be loaded and say so
 * (see main.tsx). It names no project that exists, and nothing is read or written with it: the
 * app is not drawn.
 */
export const UNCONFIGURED: InstallationConfig = {
  apiKey: "ikke-satt-opp",
  authDomain: "ikke-satt-opp.invalid",
  projectId: "ikke-satt-opp",
  appId: "ikke-satt-opp",
};
