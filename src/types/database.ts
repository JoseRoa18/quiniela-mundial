export type MatchStatus = 'pending' | 'in_progress' | 'finished';
export type PredictionResult = 'pending' | 'pleno' | 'tendencia' | 'miss';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  created_at: string;
}

export interface Match {
  id: string;
  matchday: number;
  home_team: string;
  away_team: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  start_time: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  is_featured_match: boolean;
  stage: string | null;
  group_name: string | null;
  external_id: number | null;
  created_at: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  matchday: number | null;
  predicted_home: number;
  predicted_away: number;
  points_earned: number | null;
  result_type: PredictionResult;
  used_wildcard: boolean;
  created_at: string;
  updated_at: string;
}

/** Fila devuelta por la función RPC get_leaderboard(). */
export interface LeaderboardRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  plenos: number;
  predictions_count: number;
  first_prediction_at: string | null;
  rank: number;
}
