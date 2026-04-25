/**
 * Report shapes for `dbx_storagefile_model_list_app`. Built from the same
 * {@link ExtractedAppStorageFiles} the validator produces — this tool
 * reshapes the cross-file extraction into a human-friendly summary.
 */

export interface StorageFilePurposeSummary {
  readonly purposeCode: string | undefined;
  readonly purposeSymbolName: string;
  readonly fileTypeIdentifier: string | undefined;
  readonly fileTypeIdentifierCode: string | undefined;
  readonly fileGroupIdsFunctionName: string | undefined;
  readonly subtasks: readonly string[];
  readonly hasUploadInitializer: boolean;
  readonly uploadInitializerSourceFile: string | undefined;
  readonly hasProcessingConfig: boolean;
  readonly processingConfigSourceFile: string | undefined;
  readonly sourceFile: string;
}

export interface AppStorageFilesReport {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly uploadServiceFactoryName: string | undefined;
  readonly uploadServiceWiredInApi: boolean;
  readonly processingHandlerWiredInApi: boolean;
  readonly purposes: readonly StorageFilePurposeSummary[];
}
