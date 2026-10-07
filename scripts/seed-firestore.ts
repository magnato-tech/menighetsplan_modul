import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { loadEnv } from 'vite';
import { firebaseOptionsOf, missingInstallationSettings, readInstallationConfig } from '../src/installation';
import {
  initialPersons,
  initialGroups,
  initialGatherings,
  initialTasks,
  initialAssignments,
  initialGroupMessages,
  initialGatheringAttendances,
} from '../src/data/mockData';

function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

const COLLECTIONS = {
  PERSONS: 'persons',
  GROUPS: 'groups',
  GATHERINGS: 'gatherings',
  TASKS: 'tasks',
  ASSIGNMENTS: 'assignments',
  GROUP_MESSAGES: 'groupMessages',
  GATHERING_ATTENDANCES: 'gatheringAttendances',
} as const;

async function runSeed() {
  // The script writes to the installation named in .env.local (see src/installation.ts), and to no other
  const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env };
  const installation = readInstallationConfig(env);
  if (!installation) {
    throw new Error(`Installasjonen mangler ${missingInstallationSettings(env).join(', ')}. Se .env.example.`);
  }
  console.log('Initializing Firebase app with config:', installation.projectId, 'db:', installation.firestoreDatabaseId ?? '(default)');
  const app = initializeApp(firebaseOptionsOf(installation));
  const db = installation.firestoreDatabaseId ? getFirestore(app, installation.firestoreDatabaseId) : getFirestore(app);

  console.log('Seeding persons...');
  for (const person of initialPersons) {
    await setDoc(doc(db, COLLECTIONS.PERSONS, person.id), sanitizeForFirestore(person));
    console.log(` - Person ${person.name} (${person.id}) saved`);
  }

  console.log('Seeding groups...');
  for (const group of initialGroups) {
    await setDoc(doc(db, COLLECTIONS.GROUPS, group.id), sanitizeForFirestore(group));
    console.log(` - Group ${group.name} (${group.id}) saved`);
  }

  console.log('Seeding gatherings...');
  for (const gathering of initialGatherings) {
    await setDoc(doc(db, COLLECTIONS.GATHERINGS, gathering.id), sanitizeForFirestore(gathering));
    console.log(` - Gathering ${gathering.title} (${gathering.id}) saved`);
  }

  console.log('Seeding tasks...');
  for (const task of initialTasks) {
    await setDoc(doc(db, COLLECTIONS.TASKS, task.id), sanitizeForFirestore(task));
    console.log(` - Task ${task.title} (${task.id}) saved`);
  }

  console.log('Seeding assignments...');
  for (const assignment of initialAssignments) {
    await setDoc(doc(db, COLLECTIONS.ASSIGNMENTS, assignment.id), sanitizeForFirestore(assignment));
    console.log(` - Assignment ${assignment.id} (task: ${assignment.taskId}, person: ${assignment.personId}) saved`);
  }

  console.log('Seeding group messages...');
  for (const message of initialGroupMessages) {
    await setDoc(doc(db, COLLECTIONS.GROUP_MESSAGES, message.id), sanitizeForFirestore(message));
    console.log(` - Message ${message.id} saved`);
  }

  console.log('Seeding gathering attendances...');
  for (const attendance of initialGatheringAttendances) {
    await setDoc(doc(db, COLLECTIONS.GATHERING_ATTENDANCES, attendance.id), sanitizeForFirestore(attendance));
    console.log(` - Attendance ${attendance.id} saved`);
  }

  console.log('Verifying seeded persons collection:');
  const snap = await getDocs(collection(db, COLLECTIONS.PERSONS));
  console.log(`Successfully verified! Total persons in Firestore: ${snap.size}`);

  console.log('✅ All mock data successfully populated in Firestore database!');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
