export type TypeformTemplateRefType = 'field';

export interface TypeformTemplateRef {
  /**
   * The type of ref
   */
  readonly type: TypeformTemplateRefType;
  /**
   * The full match
   *
   * I.E. {{field:123456789}}
   */
  readonly match: string;
  /**
   * The field ref value
   *
   * I.E. 123456789
   */
  readonly ref: string;
}

export function findTypeformTemplateRefsInString(input: string): TypeformTemplateRef[] {
  /**
   * Used to search the input string to find field refs like the following:
   *
   * {{field:8f7adc1e-c3b8-44bd-b00c-1b6c8de65797}}
   * {{field:01H7G3DCZ1FZV4KYZGM755MXZZ}}
   */
  const regex = /\{\{\s*(field)\s*:\s*([A-Za-z0-9-]+)\s*\}\}/g;
  const matches = input.matchAll(regex);
  const result: TypeformTemplateRef[] = [];

  for (const regexMatch of matches) {
    const match = regexMatch[0]; // {{field:8f7adc1e-c3b8-44bd-b00c-1b6c8de65797}}
    const type = regexMatch[1] as TypeformTemplateRefType; // field
    const ref = regexMatch[2]; // 8f7adc1e-c3b8-44bd-b00c-1b6c8de65797

    result.push({
      type,
      match,
      ref
    });
  }

  return result;
}
