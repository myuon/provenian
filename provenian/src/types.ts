export interface ProblemDetail {
  content: string;
  content_type: string;
  created_at: number;
  files: { [language: string]: string[] };
  id: string;
  languages: string[];
  title: string;
  updated_at: number;
  version: string;
  writer: string;
}
