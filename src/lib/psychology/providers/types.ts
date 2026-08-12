export type ScholarlyStudyType =
  | "meta_analysis"
  | "systematic_review"
  | "replication"
  | "experiment"
  | "observational"
  | "review"
  | "other";

export type ScholarlyStudy = {
  provider: "openalex";
  providerId: string;
  doi: string | null;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  studyType: ScholarlyStudyType;
  abstract: string | null;
  citedByCount: number;
  isRetracted: boolean;
  fullTextAccess: "open" | "metadata_only";
  sourceUrl: string;
  openAccessUrl: string | null;
};

export interface ScholarlySearchProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  searchStudies(query: string, limit?: number): Promise<ScholarlyStudy[]>;
  getStudy(providerId: string): Promise<ScholarlyStudy>;
}
