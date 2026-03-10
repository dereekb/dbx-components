/**
 * Represents text content that can be previewed and downloaded, including its filename and optional MIME type.
 */
export interface DownloadTextContent {
  readonly content: string;
  readonly name: string;
  readonly mimeType?: string;
}
