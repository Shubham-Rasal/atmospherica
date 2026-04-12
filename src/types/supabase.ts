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
        };
        Insert: {
          id: string;
          music_url: string;
          anon_user_id: string;
          revealed?: boolean;
          tpuf_vector_id?: string | null;
          play_count?: number;
          guess_count?: number;
        };
        Update: {
          id?: string;
          music_url?: string;
          anon_user_id?: string;
          revealed?: boolean;
          tpuf_vector_id?: string | null;
          play_count?: number;
          guess_count?: number;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Track = Database["public"]["Tables"]["tracks"]["Row"];
export type Guess = Database["public"]["Tables"]["guesses"]["Row"];

export type Scorecard = {
  emotionalAccuracy: number;
  specificity: number;
  consensus: number;
  discoveryRank: number;
  totalGuesses: number;
  overallScore: number;
  guessText: string;
};
