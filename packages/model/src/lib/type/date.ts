/**
 * Matches "Date | string.date.parse".
 *
 * This is used for validating and parsing serialized data (e.g., API responses, JSON payloads)
 * and/or runtime Date objects into the corresponding runtime types.
 *
 * If we only used Date, or only used string.date.parse, then using the ArkType gets more specific to
 * those independent cases, and will cause validation errors if you end up passing the object of that type
 * rather than a freshly parsed JSON string POJO of that type.
 */
export const ARKTYPE_DATE_DTO_TYPE = 'Date | string.date.parse';
