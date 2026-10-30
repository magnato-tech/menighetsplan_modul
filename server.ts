import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express, { Request, Response } from 'express';
import { createServer as createViteServer, loadEnv } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
  type GatheringDoc,
  type GroupDoc,
  toPublicGatherings,
  toContractV1,
  toV11,
  toPublicGroups,
  toRecurringEvents,
} from './server/publicApi';
import { markAsPrivate, renderSeoIntoHtml } from './server/pageMeta';
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, PUBLIC_GROUP_CARDS_COLLECTION } from './src/data/collections';
import { type CmsMedia, type CmsNewsArticle, type CmsPage, type CmsSettings, emptyCmsSettings } from './src/data/cmsData';
import { firebaseOptionsOf, missingInstallationSettings, readInstallationConfig } from './src/installation';
import { isPublicPath } from './src/utils/routes';
import { type SiteContent, resolvePageSeo, seoForPath } from './src/utils/siteSeo';
import { toIcalendar, toIcalendarFromGatherings } from './src/utils/calendarFeed';
import { collectionPrefixOf, parseDemoSiteId } from './src/utils/demoSite';
import { isInGroup } from './src/utils/groups';
import { personalCalendarGatheringsForFeed } from './src/utils/personalCalendar';
import { validateEvent } from './src/utils/validation';
import type { Gathering, GatheringAttendance, Group, Person } from './src/types';
import { externalCalendarIcs } from './server/icalImport';
import type { Fetch } from './server/firestoreRest';

const app = express();
// 3000 unless PORT says otherwise, so two projects can run side by side on one machine
const port = Number(process.env.PORT) || 3000;

// The server belongs to the same installation as the app, and reads the same settings: the
// hosting's own, or the .env files Vite reads on a developer's machine (see src/installation.ts)
const installationEnv = {
  ...loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), 'VITE_'),
  ...process.env,
};
const installation = readInstallationConfig(installationEnv);
if (!installation) {
  console.error(
    `Serveren startes ikke: installasjonen mangler ${missingInstallationSettings(installationEnv).join(', ')}. Se .env.example.`
  );
  process.exit(1);
}

// Initialize Firebase for server-side API proxy
const firebaseApp = initializeApp(firebaseOptionsOf(installation));
const db = installation.firestoreDatabaseId
  ? getFirestore(firebaseApp, installation.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// CORS for ClaudeCMS and external clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

function demoSiteFromQuery(req: Request): string | null {
  const raw = req.query.menighet;
  if (typeof raw !== 'string' || !raw) return null;
  if (raw === 'eksempel') return null;
  return parseDemoSiteId(raw);
}

function plannerCollection(name: string, site: string | null): string {
  return collectionPrefixOf(site) + name;
}

async function loadGatheringDocs(site: string | null = null): Promise<GatheringDoc[]> {
  const snap = await getDocs(collection(db, plannerCollection('gatherings', site)));
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return { ...data, id: data.id || docSnap.id };
  });
}

/** Public routes prefer the cards without member ids. A demo site, and a database that has no cards yet, still read the groups. */
async function loadGroupsForPublicApi(site: string | null): Promise<GroupDoc[]> {
  if (site) return loadGroupDocs(site);
  const cardsSnap = await getDocs(collection(db, PUBLIC_GROUP_CARDS_COLLECTION));
  if (!cardsSnap.empty) {
    return cardsSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      return { ...data, id: (typeof data.id === "string" && data.id) || docSnap.id };
    });
  }
  return loadGroupDocs(null);
}

async function loadGroupDocs(site: string | null = null): Promise<GroupDoc[]> {
  const snap = await getDocs(collection(db, plannerCollection('groups', site)));
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return { ...data, id: data.id || docSnap.id };
  });
}

function parseDateQuery(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const time = new Date(value).getTime();
  return isNaN(time) ? null : time;
}

/**
 * Official endpoint matching ClaudeCMS INTEGRASJON-MENIGHETSPLAN.md Contract v1:
 * GET /api/offentlig/arrangementer?fra=...&til=...
 */
app.get('/api/offentlig/arrangementer', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const items = toPublicGatherings(await loadGatheringDocs(), {
      excludeGroupGatherings: true, // gruppesamling er aldri offentlig iflg. kontrakt
      from: parseDateQuery(req.query.fra),
      to: parseDateQuery(req.query.til),
    }).map((item) => toContractV1(item, now));

    res.header('Cache-Control', 'public, max-age=300');
    res.json({
      versjon: 1,
      kilde: 'menighetsplan',
      generert: now.toISOString(),
      tidssone: 'Europe/Oslo',
      arrangementer: items,
    });
  } catch (err: any) {
    console.error('Error fetching /api/offentlig/arrangementer:', err);
    res.status(500).json({ error: 'Kunne ikke hente arrangementer', message: err.message });
  }
});

/**
 * Public iCal subscription for open community gatherings (same inclusion rule as the calendar module).
 */
app.get('/api/offentlig/kalender.ics', async (req: Request, res: Response) => {
  try {
    const site = demoSiteFromQuery(req);
    const now = new Date();
    const gatherings: Gathering[] = [];
    for (const doc of await loadGatheringDocs(site)) {
      try {
        gatherings.push(validateEvent(doc));
      } catch (err) {
        console.warn(
          `iCal feed: skipping invalid gathering ${doc.id ?? '(no id)'}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    let calendarName = 'Menighetsplan';
    try {
      const settingsSnap = await getDoc(doc(db, plannerCollection(CMS_COLLECTIONS.SETTINGS, site), CMS_SETTINGS_DOC_ID));
      const churchName = settingsSnap.data()?.churchName;
      if (typeof churchName === 'string' && churchName.trim()) {
        calendarName = churchName.trim();
      }
    } catch {
      // Default name is fine when settings are unavailable
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="kalender.ics"');
    res.set('Cache-Control', 'public, max-age=300');
    // Each event carries the address of its own page on the website
    res.send(toIcalendar(gatherings, { calendarName, now, siteUrl: `${req.protocol}://${req.get('host')}` }));
  } catch (err: any) {
    console.error('Error fetching /api/offentlig/kalender.ics:', err);
    res.status(500).json({ error: 'Kunne ikke hente kalenderabonnement', message: err.message });
  }
});

/** iCal feed for import when our website is off (URL from cms_settings/surfaces, not from the query). */
app.get('/api/kalender-innhold', async (_req: Request, res: Response) => {
  try {
    const feed = await externalCalendarIcs({
      env: installationEnv,
      ask: fetch as unknown as Fetch,
      httpFetch: fetch,
    });
    for (const [name, value] of Object.entries(feed.headers)) res.set(name, value);
    res.status(feed.status).send(feed.body);
  } catch (err: unknown) {
    console.error('Error fetching /api/kalender-innhold:', err);
    res.status(500).send('Kunne ikke hente kalenderen.');
  }
});

/**
 * Personal iCal feed for Min kalender (token on the person document; optional menighet in the demo).
 */
app.get('/api/min/kalender.ics', async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) {
      res.status(400).send('Mangler token');
      return;
    }

    const site = demoSiteFromQuery(req);
    const personsSnap = await getDocs(
      query(collection(db, plannerCollection('persons', site)), where('calendarFeedToken', '==', token))
    );
    if (personsSnap.empty) {
      res.status(404).send('Ugyldig kalenderlenke');
      return;
    }

    const personDoc = personsSnap.docs[0];
    const person = { ...(personDoc.data() as Person), id: personDoc.data().id || personDoc.id };

    const [gatheringDocs, groupDocs, attendanceSnap] = await Promise.all([
      loadGatheringDocs(site),
      loadGroupDocs(site),
      getDocs(collection(db, plannerCollection('gatheringAttendances', site))),
    ]);

    const groups = groupDocs as Group[];
    const myGroups = groups.filter((group) => isInGroup(group, person.id));
    const attendances: GatheringAttendance[] = attendanceSnap.docs.map((docSnap) => {
      const data = docSnap.data() as GatheringAttendance;
      return { ...data, id: data.id || docSnap.id };
    });
    const attendanceOf = (gatheringId: string) =>
      attendances.find((row) => row.personId === person.id && row.gatheringId === gatheringId);

    const gatherings: Gathering[] = [];
    for (const doc of gatheringDocs) {
      try {
        gatherings.push(validateEvent(doc));
      } catch (err) {
        console.warn(
          `Personal iCal: skipping invalid gathering ${doc.id ?? '(no id)'}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const now = new Date();
    const selected = personalCalendarGatheringsForFeed(gatherings, myGroups, now, attendanceOf);

    let calendarName = `${person.name} – Menighetsplan`;
    try {
      const settingsSnap = await getDoc(doc(db, plannerCollection('cms_settings', site), CMS_SETTINGS_DOC_ID));
      const churchName = settingsSnap.data()?.churchName;
      if (typeof churchName === 'string' && churchName.trim()) {
        calendarName = `${person.name} – ${churchName.trim()}`;
      }
    } catch {
      // Default name is fine when settings are unavailable
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="min-kalender.ics"');
    res.set('Cache-Control', 'private, max-age=300');
    res.send(
      toIcalendarFromGatherings(selected, {
        calendarName,
        now,
        siteUrl: `${req.protocol}://${req.get('host')}`,
      })
    );
  } catch (err: any) {
    console.error('Error fetching /api/min/kalender.ics:', err);
    res.status(500).json({ error: 'Kunne ikke hente kalenderabonnement', message: err.message });
  }
});

/**
 * Public JSON API: Gatherings (with embedded recurring and groups for simplicity)
 */
app.get('/api/public/gatherings', async (_req: Request, res: Response) => {
  try {
    const [gatheringDocs, groupDocs] = await Promise.all([loadGatheringDocs(), loadGroupsForPublicApi(null)]);
    const items = toPublicGatherings(gatheringDocs).map(toV11);
    const groups = toPublicGroups(groupDocs);
    const recurringEvents = toRecurringEvents(groupDocs);

    res.json({
      versjon: '1.1',
      status: 'ok',
      kilde: 'Menighetsplan Firestore API',
      generert: new Date().toISOString(),
      antall: items.length,
      arrangementer: items,
      gatherings: items,
      grupper: groups,
      groups: groups,
      gjentagende_eventer: recurringEvents,
      recurringEvents: recurringEvents,
    });
  } catch (err: any) {
    console.error('Error fetching public gatherings for CMS:', err);
    res.status(500).json({
      error: 'Kunne ikke hente arrangementer fra Menighetsplan',
      message: err.message || 'Ukjent feil',
    });
  }
});

/**
 * Dedicated Public JSON API: Groups (Husfellesskap, Tjenestegrupper osv.)
 */
app.get('/api/public/groups', async (_req: Request, res: Response) => {
  try {
    const groups = toPublicGroups(await loadGroupsForPublicApi(null));
    res.json({
      versjon: '1.1',
      status: 'ok',
      generert: new Date().toISOString(),
      antall: groups.length,
      grupper: groups,
      groups: groups,
    });
  } catch (err: any) {
    console.error('Error fetching public groups for CMS:', err);
    res.status(500).json({ error: 'Kunne ikke hente grupper', message: err.message });
  }
});

/**
 * Dedicated Public JSON API: Recurring Events (faste møtetider, gudstjenester, husfellesskap)
 */
app.get('/api/public/recurring', async (_req: Request, res: Response) => {
  try {
    const recurringEvents = toRecurringEvents(await loadGroupsForPublicApi(null));
    res.json({
      versjon: '1.1',
      status: 'ok',
      generert: new Date().toISOString(),
      antall: recurringEvents.length,
      gjentagende_eventer: recurringEvents,
      recurringEvents: recurringEvents,
    });
  } catch (err: any) {
    console.error('Error fetching recurring events for CMS:', err);
    res.status(500).json({ error: 'Kunne ikke hente gjentagende eventer', message: err.message });
  }
});

/**
 * All-in-one endpoint
 */
app.get('/api/public/all', async (_req: Request, res: Response) => {
  try {
    const [gatheringDocs, groupDocs] = await Promise.all([loadGatheringDocs(), loadGroupsForPublicApi(null)]);
    res.json({
      versjon: '1.1',
      status: 'ok',
      generert: new Date().toISOString(),
      arrangementer: toPublicGatherings(gatheringDocs).map(toV11),
      grupper: toPublicGroups(groupDocs),
      gjentagende_eventer: toRecurringEvents(groupDocs),
    });
  } catch (err: any) {
    console.error('Error fetching all public data for CMS:', err);
    res.status(500).json({ error: 'Kunne ikke hente data', message: err.message });
  }
});

// Unmatched API paths must not fall through to the SPA (Vite serves index.html for .ics etc.)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Fant ikke API-endepunkt' });
});

// ---------------------------------------------------------------------------
// Page titles and share cards
// ---------------------------------------------------------------------------
// A service that previews a shared link reads the HTML as it is sent and never runs the
// app. The server therefore writes each page's title, description and image into
// index.html. What they are is decided in src/utils/siteSeo.ts, which the browser uses too.

const SITE_CONTENT_MAX_AGE_MS = 60_000;
const FIRST_READ_WAIT_MS = 1_500;

let siteContent: SiteContent | null = null;
let siteContentReadAt = 0;
let siteContentRead: Promise<void> | null = null;

async function readSiteContent(): Promise<SiteContent> {
  const [pages, news, gatherings, media, settings] = await Promise.all([
    getDocs(collection(db, CMS_COLLECTIONS.PAGES)),
    getDocs(collection(db, CMS_COLLECTIONS.NEWS)),
    // The events, for the page each of them has. Without them an event page gets the church's own title
    loadGatheringDocs().catch(() => []),
    getDocs(collection(db, CMS_COLLECTIONS.MEDIA)).catch(() => null),
    // The settings may be missing or unreadable; the app then shows its defaults, and so do we
    getDoc(doc(db, CMS_COLLECTIONS.SETTINGS, CMS_SETTINGS_DOC_ID)).catch(() => null),
  ]);
  return {
    pages: pages.docs.map((d) => d.data() as CmsPage),
    news: news.docs.map((d) => d.data() as CmsNewsArticle),
    gatherings: gatherings as Gathering[],
    media: media?.docs.map((d) => d.data() as CmsMedia) ?? [],
    settings: settings?.exists() ? (settings.data() as CmsSettings) : emptyCmsSettings,
  };
}

function refreshSiteContent(): Promise<void> {
  siteContentRead ??= readSiteContent()
    .then((content) => {
      siteContent = content;
    })
    .catch((err) => {
      // What was read last, if anything, keeps being used
      console.error('Could not read the site content for page titles:', err);
    })
    .finally(() => {
      siteContentReadAt = Date.now();
      siteContentRead = null;
    });
  return siteContentRead;
}

/**
 * The pages, articles and settings as last read, refreshed in the background once a minute.
 * A page is never held back by the database: only the very first read is waited for, briefly.
 */
async function currentSiteContent(): Promise<SiteContent | null> {
  if (Date.now() - siteContentReadAt > SITE_CONTENT_MAX_AGE_MS) {
    const reading = refreshSiteContent();
    if (!siteContent) {
      await Promise.race([reading, new Promise((resolve) => setTimeout(resolve, FIRST_READ_WAIT_MS))]);
    }
  }
  return siteContent;
}

/** The address the site is reached at, for canonical links and share images. */
function originOf(req: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const protocol = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0].trim();
  return `${protocol}://${req.get('host') ?? `localhost:${port}`}`;
}

async function sendApp(req: Request, res: Response) {
  // A file that does not exist is a missing file, not the app
  if (path.extname(req.path)) {
    res.status(404).end();
    return;
  }

  const html = await readFile(path.join('dist', 'index.html'), 'utf8');
  // The page itself is small and names the current script files, so it is always fetched anew
  res.set('Cache-Control', 'no-cache');

  if (!isPublicPath(req.path)) {
    res.type('html').send(markAsPrivate(html));
    return;
  }

  const site = await currentSiteContent();
  const config = site ? seoForPath(req.path, site) : null;
  if (!config) {
    res.type('html').send(html);
    return;
  }

  const seo = resolvePageSeo(config, originOf(req), req.path, site?.media ?? []);
  res
    .status(seo.notFound ? 404 : 200)
    .type('html')
    .send(renderSeoIntoHtml(html, seo));
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // index.html goes through sendApp, also for the front page
    app.use(express.static('dist', { index: false }));
    app.get('*', (req: Request, res: Response) => {
      sendApp(req, res).catch((err) => {
        console.error('Could not send the app:', err);
        res.status(500).send('Noe gikk galt. Prøv igjen om litt.');
      });
    });
    void refreshSiteContent();
  } else {
    const vite = await createViteServer({
      // The live reload gets its own port next to Vite's usual one, moved as far as the app's port is
      server: { middlewareMode: true, hmr: { port: 24678 + (port - 3000) } },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      vite.middlewares(req, res, next);
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Menighetsplan server running on port ${port}`);
  });
}

startServer();
