// Hand-written types matching supabase/schema.sql. If the schema changes, update this file
// (or swap it for `supabase gen types typescript` output once the project is linked).
import type {
  CaptionRecord,
  Clip,
  ExportRecord,
  Generation,
  Profile,
  Project,
} from "./domain";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: Partial<Project> & { owner_id: string; name: string };
        Update: Partial<Project>;
        Relationships: [];
      };
      generations: {
        Row: Generation;
        Insert: Partial<Generation> & {
          project_id: string;
          owner_id: string;
          prompt: string;
          model: string;
          duration_seconds: number;
        };
        Update: Partial<Generation>;
        Relationships: [];
      };
      clips: {
        Row: Clip;
        Insert: Partial<Clip> & { project_id: string; source_url: string };
        Update: Partial<Clip>;
        Relationships: [];
      };
      exports: {
        Row: ExportRecord;
        Insert: Partial<ExportRecord> & { project_id: string; owner_id: string; video_url: string };
        Update: Partial<ExportRecord>;
        Relationships: [];
      };
      captions: {
        Row: CaptionRecord;
        Insert: Partial<CaptionRecord> & { project_id: string; platform: string; content: string };
        Update: Partial<CaptionRecord>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
