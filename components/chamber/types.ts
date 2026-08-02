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
  forum_visibility: string;
  child_count: number;
};
