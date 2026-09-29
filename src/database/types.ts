/**
 * Shared types for the database layer.
 */

/** A single indexed document (image or PDF) stored in `document_index`. */
export interface DocumentRecord {
  id?: number;
  title?: string;
  content: string;
  filePath: string;
  type: 'IMAGE' | 'DOCUMENT';
  detection_type: 'TEXT' | 'OBJECT';
  timestamp: number;
}
