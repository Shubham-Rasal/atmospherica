export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      tracks: {
        Row: {
          id: string;
          created_at: string;
          music_url: string;
          anon_user_id: string;
          play_count: number;
          guess_count: number;
          revealed: boolean;
          tpuf_vector_id: string | null;
          feeling_text: string | null;
          grid_position: number | null;
        };
        Insert: {
          id: string;
          music_url: string;
          anon_user_id: string;
          revealed?: boolean;
          tpuf_vector_id?: string | null;
          play_count?: number;
          guess_count?: number;
          feeling_text?: string | null;
          grid_position?: number | null;
        };
        Update: {
          id?: string;
          music_url?: string;
          anon_user_id?: string;
          revealed?: boolean;
          tpuf_vector_id?: string | null;
          play_count?: number;
          guess_count?: number;
          feeling_text?: string | null;
          grid_position?: number | null;
        };
      };
      guesses: {
        Row: {
          id: string;
          created_at: string;
          track_id: string;
          guesser_id: string;
          guess_text: string;
          similarity_score: number;
          specificity_score: number;
          consensus_score: number;
          discovery_rank: number;
          overall_score: number;
        };
        Insert: {
          id: string;
          track_id: string;
          guesser_id: string;
          guess_text: string;
          similarity_score?: number;
          specificity_score?: number;
          consensus_score?: number;
          discovery_rank?: number;
          overall_score?: number;
        };
        Update: {
          id?: string;
          track_id?: string;
          guesser_id?: string;
          guess_text?: string;
          similarity_score?: number;
          specificity_score?: number;
          consensus_score?: number;
          discovery_rank?: number;
          overall_score?: number;
        };
      };
      master_tracks: {
        Row: {
          id: string;
          created_at: string;
          music_url: string;
          prompt: string | null;
          tile_count: number | null;
          version: number | null;
        };
        Insert: {
          id?: string;
          music_url: string;
          prompt?: string | null;
          tile_count?: number | null;
          version?: number | null;
        };
        Update: {
          id?: string;
          music_url?: string;
          prompt?: string | null;
          tile_count?: number | null;
          version?: number | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Track = Database["public"]["Tables"]["tracks"]["Row"] & { grid_position: number | null };
export type MasterTrack = Database["public"]["Tables"]["master_tracks"]["Row"];
