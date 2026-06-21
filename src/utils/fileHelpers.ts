import type { CapturedPhoto, PhotoStep } from '../types';

/**
 * File / sharing helpers.
 *
 * Browser notes:
 * - The Web Share API (level 2, with files) is only available over HTTPS and
 *   on a subset of browsers — chiefly mobile Safari and Chrome. We always
 *   feature-detect before using it.
 * - navigator.canShare({ files }) is the only reliable way to know whether a
 *   given set of files can actually be shared.
 */

/** Wrap a Blob in a named File with the correct mime type. */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now(),
  });
}

/**
 * Build the set of shareable image files (front.jpg, right-profile.jpg, ...)
 * from the captured photos, in step order.
 */
export function createShareableFiles(
  steps: PhotoStep[],
  photos: Record<string, CapturedPhoto>,
): File[] {
  return steps
    .filter((step) => photos[step.id])
    .map((step) => blobToFile(photos[step.id].blob, step.fileName));
}

/** Whether the browser can share these specific files via the native sheet. */
export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files })
  );
}

/** Trigger a browser download for a single file. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Bundle all files into a single ZIP and download it.
 * JSZip is imported lazily so it is not part of the initial bundle.
 */
export async function downloadAllAsZip(files: File[]): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadFile(blobToFile(blob, 'hair-photos.zip'));
}
