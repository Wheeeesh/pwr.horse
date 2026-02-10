export type ConverterCategory =
  | 'Documents'
  | 'Images'
  | 'Video'
  | 'Audio'
  | 'Archives'
  | 'Data'
  | 'QR';

export type OptionType =
  | 'select'
  | 'number'
  | 'text'
  | 'checkbox'
  | 'color'
  | 'range'
  | 'textarea';

export interface ConverterOption {
  id: string;
  label: string;
  type: OptionType;
  default?: string | number | boolean;
  choices?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  help?: string;
}

export interface ConverterContext {
  signal: AbortSignal;
  onProgress: (value: number) => void;
}

export interface ConversionResult {
  name: string;
  blob: Blob;
  mime: string;
}

export interface Converter {
  id: string;
  title: string;
  category: ConverterCategory;
  description: string;
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  options?: ConverterOption[];
  run: (
    files: File[],
    options: Record<string, string | number | boolean>,
    ctx: ConverterContext
  ) => Promise<ConversionResult[]>;
}
