export type TextSnippetLine = { line: number; text: string };

export type TextMatch = {
  file: string;
  line: number;
  col: number;
  lineText: string;
  snippet: TextSnippetLine[];
};

export type TraceHit = { file: string; label: string; line?: number; note?: string };

