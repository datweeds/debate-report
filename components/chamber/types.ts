import type { ChamberStatement, ChamberRelationship } from './ChamberGraph';

export type { ChamberStatement, ChamberRelationship };

export type Resolution = {
  id: string;
  stat_title: string;
  stat_description: string | null;
  subject_area: string;
  customer_id: number | null;
  debate_visibility: string; // 'public' | 'apply' | 'invite'
  society_is_public: boolean | null;
  can_set_visibility: boolean;
  image_path: string | null;
  created_at: string;
  created_by: string | null;
  creator_handle: string | null;
  // Close debate fields
  stat_status: string;
  resolution_decision: 'for' | 'against' | 'draw' | null;
  closing_statement: string | null;
  vote_total_for: number;
  vote_total_against: number;
};

export type FullStatement = ChamberStatement & {
  stat_description: string | null;
  created_at: string;
  creator_handle: string | null;
  agree_count: number;
  disagree_count: number;
};

export type ChamberData = {
  resolution: Resolution;
  statements: FullStatement[];
  relationships: ChamberRelationship[];
};

export type PublicDebate = {
  id: string;
  stat_title: string;
  subject_area: string;
  debate_visibility: string; // 'public' | 'apply' | 'invite'
  vote_for: number;
  vote_against: number;
  child_count: number;
  science_count: number;
  chat_count: number;
  society_name: string | null;
  customer_id: number | null;
};
