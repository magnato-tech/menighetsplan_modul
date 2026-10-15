import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { CMS_COLLECTIONS, NEWSLETTER_OPT_OUTS_COLLECTION } from "../data/collections";
import { NEWSLETTER_BANNER_DOC_ID, NEWSLETTER_BANNER_RECORD } from "../data/settingsRecords";
import { db } from "../firebase";
import { newsletterBannerOf } from "../utils/newsletter";

// The newsletter's two stores (see utils/newsletter.ts): who has unsubscribed, and the banner.

/** Follows the keys that have unsubscribed. Only an administrator may list them. Returns the function that stops following. */
export function subscribeNewsletterOptOuts(onChange: (keys: string[]) => void, onError?: (error: Error) => void): () => void {
  return onSnapshot(
    collection(db, NEWSLETTER_OPT_OUTS_COLLECTION),
    (snapshot) => onChange(snapshot.docs.map((one) => one.id)),
    (error) => onError?.(error)
  );
}

/** Whether a key has unsubscribed already. Anyone with the key may ask. */
export async function isOptedOut(key: string): Promise<boolean> {
  return (await getDoc(doc(db, NEWSLETTER_OPT_OUTS_COLLECTION, key))).exists();
}

/** Unsubscribes the one whose key it is. The document holds when, and nothing else. */
export function optOut(key: string, now: Date = new Date()): Promise<void> {
  return setDoc(doc(db, NEWSLETTER_OPT_OUTS_COLLECTION, key), { at: now.toISOString() });
}

/** Lets the newsletter go to them again: the administrator's undo. */
export function optBackIn(key: string): Promise<void> {
  return deleteDoc(doc(db, NEWSLETTER_OPT_OUTS_COLLECTION, key));
}

const bannerDoc = () => doc(db, CMS_COLLECTIONS.SETTINGS, NEWSLETTER_BANNER_DOC_ID);

/** Follows the banner: the picture as it is stored, or null when there is none. */
export function subscribeNewsletterBanner(onChange: (imageUrl: string | null) => void, onError?: (error: Error) => void): () => void {
  return onSnapshot(
    bannerDoc(),
    (snapshot) => {
      const data = snapshot.data();
      onChange(data?.recordType === NEWSLETTER_BANNER_RECORD && newsletterBannerOf(data.imageUrl) ? (data.imageUrl as string) : null);
    },
    (error) => onError?.(error)
  );
}

/** Stores the banner. The time it is stored at, is part of its address in the e-mail, so an inbox fetches the new one. */
export function saveNewsletterBanner(imageUrl: string, now: Date = new Date()): Promise<void> {
  return setDoc(bannerDoc(), { recordType: NEWSLETTER_BANNER_RECORD, imageUrl, updatedAt: now.toISOString() });
}

export function removeNewsletterBanner(): Promise<void> {
  return deleteDoc(bannerDoc());
}
