export type SourceRef = {
  id: string;
  name: string;
  publisher: string;
  url: string;
  fiscalYear?: number;
  taxYear?: number;
  /** Statement date or publication period, not the moment the app fetched it. */
  asOf?: string;
  notes?: string;
};

export type Attributed<T> = {
  data: T;
  source: SourceRef;
};

/**
 * A data source is a module under src/lib/sources that exports async functions
 * returning Attributed<T>. Register a short description in registry.ts so the
 * About page and future contributors can find it.
 */
export type SourceModule = {
  id: string;
  title: string;
  summary: string;
  module: string;
  docsUrl: string;
};
