import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { loadEnv } from 'vite';
import { COLLECTIONS } from '../src/data/collections';
import { firebaseOptionsOf, missingInstallationSettings, readInstallationConfig } from '../src/installation';
import type { Person } from '../src/types';
import { planFirstAdmin } from '../src/utils/firstAdmin';

// Puts the first administrator in the register of the installation named in .env.local
// (see src/utils/firstAdmin.ts for why it has to be done from the outside, once).
//
//   npm run first-admin -- kari@menigheten.no "Kari Nordmann"
//
// It writes with the same access as the app has. Once the database rules are closed, this will
// have to be run with the vendor's own access instead.

async function main() {
  const [email = '', name = ''] = process.argv.slice(2);
  if (!email) {
    throw new Error('Bruk: npm run first-admin -- <e-postadresse> "<navn>"');
  }

  const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env };
  const installation = readInstallationConfig(env);
  if (!installation) {
    throw new Error(`Installasjonen mangler ${missingInstallationSettings(env).join(', ')}. Se .env.example.`);
  }
  const app = initializeApp(firebaseOptionsOf(installation));
  const db = installation.firestoreDatabaseId ? getFirestore(app, installation.firestoreDatabaseId) : getFirestore(app);
  console.log(`Installasjon: ${installation.projectId}${installation.tenantId ? ` (${installation.tenantId})` : ''}`);

  const snapshot = await getDocs(collection(db, COLLECTIONS.PERSONS));
  const persons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Person);
  const plan = planFirstAdmin(email, name, persons);

  switch (plan.action) {
    case 'refuse':
      throw new Error(plan.reason);
    case 'none':
      console.log(`${plan.person.name} er administrator fra før. Ingenting er endret.`);
      break;
    case 'promote':
      await updateDoc(doc(db, COLLECTIONS.PERSONS, plan.person.id), { globalRole: 'admin' });
      console.log(`${plan.person.name} står i registeret fra før, og er nå administrator.`);
      break;
    case 'create':
      await setDoc(doc(db, COLLECTIONS.PERSONS, plan.person.id), plan.person);
      console.log(`${plan.person.name} er lagt inn i registeret som administrator.`);
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
