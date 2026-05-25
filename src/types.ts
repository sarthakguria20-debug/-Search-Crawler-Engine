export interface DocumentInfo {
  id: string;
  url: string;
  title: string;
  snippet: string;
}

export interface SearchResult {
  doc: DocumentInfo;
  score: number;
}

export interface SearchResponse {
  timeMs: string;
  count: number;
  results: SearchResult[];
}

export interface EngineStatus {
  indexedDocuments: number;
  indexedTerms: number;
  isCrawling: boolean;
  visitedUrlsCount: number;
  queueLength: number;
}
