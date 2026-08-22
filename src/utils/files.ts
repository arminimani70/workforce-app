import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

// The MIME types the app accepts wherever a user attaches a document/image, passed straight to
// expo-document-picker's `type` option — kept in sync with the backend's own multer allow-list.
export const ATTACHMENT_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/*',
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function iconForMimeType(mimeType: string): ComponentProps<typeof Ionicons>['name'] {
  if (mimeType === 'application/pdf') return 'document-text-outline';
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType.includes('word')) return 'document-outline';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
  return 'document-attach-outline';
}
