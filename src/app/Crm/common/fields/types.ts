/** The custom field types the server knows (spec §6.5). */
export type FieldType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'CURRENCY'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'USER';

export interface FieldOptionDef {
  key: string;
  label: string;
  color: string | null;
  position: number;
  active: boolean;
}

/** What the field components need of a definition; kept free of the CRM API types. */
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options: FieldOptionDef[];
  required: boolean;
  active: boolean;
  showInList: boolean;
  showInCard: boolean;
  position: number;
}

export interface FieldUser {
  id: string;
  name: string;
}
