import type { ChamberStatement, ChamberRelationship } from './ChamberGraph';

export type { ChamberStatement, ChamberRelationship };

export type Resolution = {
  id: string;
  stat_title: string;
  stat_description: string | null;
  subject_area: string;
  forum_visibility: string;
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
  forum_id: string | null;
  forum_type: string;       // 'public' | 'private'
  forum_visibility: string; // 'public' | 'invite' | 'apply'
  forum_title: string | null;
  vote_for: number;
  vote_against: number;
  child_count: number;
  science_count: number;
  chat_count: number;
};
