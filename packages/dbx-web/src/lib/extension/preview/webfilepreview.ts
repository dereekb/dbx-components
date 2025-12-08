import { type MatDialogConfig, type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type WebsiteUrlWithPrefix, type Maybe, type ContentTypeMimeType, type ArrayOrValue, type MimeTypeWithoutParameters } from '@dereekb/util';

/**
 * Configuration for a DbxWebFilePreviewServicePreviewComponentFunction.
 */
export interface DbxWebFilePreviewServicePreviewComponentFunctionInput {
  /**
   * The srcUrl to preview, if applicable.
   *
   * Either the srcUrl or the blob must be provided.
   */
  readonly srcUrl?: Maybe<WebsiteUrlWithPrefix>;

  /**
   * Whether or not to sanitize the srcUrl. Ignored if srcUrl is not provided.
   *
   * Defaults to true.
   */
  readonly sanitizeSrcUrl?: Maybe<boolean>;

  /**
   * The blob to preview, if applicable. The embedMimeType should also be provided.
   *
   * Either the srcUrl or the blob must be provided.
   */
  readonly blob?: Maybe<Blob>;

  /**
   * The mimetype to instruct the browser to use for the preview.
   *
   * Should typically be provided, otherwise the browser will guess how to handle the data.
   */
  readonly embedMimeType?: Maybe<ContentTypeMimeType | string>;
}

/**
 * Used for generating a preview component for the given src url and embedMimeType.
 */
export type DbxWebFilePreviewServicePreviewComponentFunction = (input: DbxWebFilePreviewServicePreviewComponentFunctionInput) => DbxInjectionComponentConfig<any>;

/**
 * Configuration for a DbxWebFilePreviewServicePreviewDialogFunction.
 */
export interface DbxWebFilePreviewServicePreviewDialogFunctionInput extends DbxWebFilePreviewServicePreviewComponentFunctionInput {
  /**
   * Arbitrary MatDialogConfig to use for configuring the dialog.
   */
  readonly dialogConfig?: Maybe<Omit<MatDialogConfig, 'data'>>;
}

/**
 * Configuration for a DbxWebFilePreviewServicePreviewDialogFunction.
 */
export interface DbxWebFilePreviewServicePreviewDialogFunctionInputWithMatDialog extends DbxWebFilePreviewServicePreviewDialogFunctionInput {
  /**
   * MatDialog instance to use for opening the dialog.
   */
  readonly matDialog: MatDialog;
}

/**
 * Used for previewing a src url and embedMimeType in a dialog.
 */
export type DbxWebFilePreviewServicePreviewDialogFunction = (input: DbxWebFilePreviewServicePreviewDialogFunctionInputWithMatDialog) => MatDialogRef<any, any>;

/**
 * Configuration for a preview entry.
 */
export interface DbxWebFilePreviewServiceEntry {
  /**
   * The MimeType(s) to associate the preview function with.
   */
  readonly mimeType: ArrayOrValue<MimeTypeWithoutParameters | string>;

  /**
   * The preview component function to use.
   */
  readonly previewComponentFunction: DbxWebFilePreviewServicePreviewComponentFunction;

  /**
   * The preview dialog function to use.
   *
   * If one is not provided, a default dialog will be used that opens the preview component in a dialog.
   */
  readonly previewDialogFunction?: DbxWebFilePreviewServicePreviewDialogFunction;
}

/**
 * Configuration for a DbxWebFilePreviewServicePreviewDialogWithComponentFunction.
 */
export interface DbxWebFilePreviewServicePreviewDialogWithComponentFunctionInput extends Omit<DbxWebFilePreviewServicePreviewDialogFunctionInputWithMatDialog, 'dialogConfig'> {
  /**
   * The component configuration for the component to display in the dialog.
   */
  readonly componentConfig: DbxInjectionComponentConfig<any>;
}

/**
 * Used for previewing a src url and embedMimeType in a dialog.
 */
export type DbxWebFilePreviewServicePreviewDialogWithComponentFunction = (input: DbxWebFilePreviewServicePreviewDialogWithComponentFunctionInput) => MatDialogRef<any, any>;

/**
 * @deprecated use DbxWebFilePreviewServicePreviewDialogFunction instead.
 */
export type DbxWebFilePreviewServicePreviewFunction = DbxWebFilePreviewServicePreviewDialogFunction;
