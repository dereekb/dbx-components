/**
 * Report types for `dbx_system_m_list_app`.
 */

import type { FolderInspectionStatus } from '../system-m-validate-folder/types.js';

export type { FolderInspectionStatus } from '../system-m-validate-folder/types.js';

export interface SystemStateMember {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
}

export interface SystemStateConverterMember extends SystemStateMember {
  readonly dataTypeArgument: string | undefined;
}

export interface SystemStatePairing {
  readonly typeConstant: SystemStateMember;
  readonly dataInterface: SystemStateMember | undefined;
  readonly converter: SystemStateConverterMember | undefined;
  readonly inConverterMap: boolean;
  /**
   * True when every leg of the triplet is present and the type
   * constant is referenced by the aggregate converter map.
   */
  readonly complete: boolean;
}

export interface SystemMListAppReport {
  readonly componentDir: string;
  readonly folderPath: string;
  readonly status: FolderInspectionStatus;
  readonly hasSystemSource: boolean;
  readonly converterMapName: string | undefined;
  readonly converterMapTypeAnnotation: string | undefined;
  readonly pairings: readonly SystemStatePairing[];
}
