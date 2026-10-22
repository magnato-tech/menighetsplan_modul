import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import type { CmsMedia, CmsMediaVariants } from "../data/cmsData";
import type { MediaVariantBlobs } from "../utils/imageVariants";
import { newId } from "../utils/id";
import { storedImageType } from "../utils/storedImages";

const VARIANT_FILES = {
  source: "source.jpg",
  web: "web.jpg",
  thumb: "thumb.jpg",
  og: "og.jpg",
} as const;

function mediaPath(mediaId: string, fileName: string): string {
  return `media/${mediaId}/${fileName}`;
}

async function uploadVariant(mediaId: string, fileName: string, blob: Blob): Promise<string> {
  const storageRef = ref(storage, mediaPath(mediaId, fileName));
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

/** Uploads all image variants and returns their public download URLs. */
export async function uploadMediaVariants(
  mediaId: string,
  blobs: MediaVariantBlobs
): Promise<{ variants: CmsMediaVariants; sourcePath: string; byteSize: number }> {
  const [, web, thumb, og] = await Promise.all([
    uploadVariant(mediaId, VARIANT_FILES.source, blobs.source),
    uploadVariant(mediaId, VARIANT_FILES.web, blobs.web),
    uploadVariant(mediaId, VARIANT_FILES.thumb, blobs.thumb),
    uploadVariant(mediaId, VARIANT_FILES.og, blobs.og),
  ]);

  return {
    sourcePath: mediaPath(mediaId, VARIANT_FILES.source),
    byteSize: blobs.source.size,
    variants: { web, thumb, og },
  };
}

/**
 * Uploads one picture as it is, without making it smaller or turning it into a JPEG, so a logo keeps
 * its transparent background. It lands where the picture library's files do, under its own folder,
 * which the storage rules already let an administrator write. Returns its public address.
 */
export async function uploadImageFile(file: Blob, name: string): Promise<string> {
  const storageRef = ref(storage, mediaPath(newId("fil"), name));
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}

/** Uploads a picture kept as text in the database, and returns its address in the store. */
export async function uploadStoredImage(image: string, baseName = "bilde"): Promise<string> {
  const { extension } = storedImageType(image);
  const blob = await (await fetch(image)).blob();
  return uploadImageFile(blob, `${baseName}.${extension}`);
}

export async function deleteMediaStorageFiles(mediaId: string): Promise<void> {
  const names = Object.values(VARIANT_FILES);
  await Promise.all(
    names.map(async (fileName) => {
      try {
        await deleteObject(ref(storage, mediaPath(mediaId, fileName)));
      } catch {
        // Missing file is fine during cleanup
      }
    })
  );
}

export function pickMediaPreviewUrl(item: CmsMedia): string {
  return item.variants.thumb || item.variants.web || "";
}
