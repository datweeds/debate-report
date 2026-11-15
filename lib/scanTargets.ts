// Every piece of user-written text the abuse scanner checks: where it's stored,
// which Society it belongs to, who wrote it, and where it can be seen. The
// sweep, the alert queue and masking all work from this one list, so adding a
// new kind of content means adding one entry here.

export type ScanTarget = {
  type: string;          // content_alerts.content_type
  label: string;         // shown in the alert queue
  table: string;         // table holding the text (for masking)
  column: string;        // column holding the text
  idColumn: string;      // primary key of that table
  // SELECT pieces, with the text's table aliased as t
  from: string;
  where?: string;
  society: string;       // SQL giving customer_id (or NULL)
  author: string;        // SQL giving the author's user id (or NULL)
  resolution?: string;   // SQL giving the debate's resolution id, for debate content
  href: string;          // SQL giving a link to where the text appears
};

const stmt = (type: string, label: string, column: string): ScanTarget => ({
  type, label, table: 'statements', column, idColumn: 'id',
  from: 'statements t LEFT JOIN statements r ON r.id = t.resolution_id',
  society: 'COALESCE(r.customer_id, t.customer_id)',
  author: 't.created_by',
  resolution: 'COALESCE(t.resolution_id, t.id)',
  href: `'/chamber?resolution=' || COALESCE(t.resolution_id, t.id) || '&statement=' || t.id`,
});

const society = (cid: string, path: string) => `'/society/' || ${cid} || '${path}'`;

export const SCAN_TARGETS: ScanTarget[] = [
  stmt('statement_title', 'Statement title', 'stat_title'),
  stmt('statement_description', 'Statement description', 'stat_description'),
  {
    type: 'comment', label: 'Debate chat message', table: 'comments', column: 'comment_body', idColumn: 'id',
    from: 'comments t JOIN statements s ON s.id = t.statement_id LEFT JOIN statements r ON r.id = s.resolution_id',
    where: 'NOT t.is_deleted',
    society: 'COALESCE(r.customer_id, s.customer_id)', author: 't.created_by',
    resolution: 'COALESCE(s.resolution_id, s.id)',
    href: `'/chamber?resolution=' || COALESCE(s.resolution_id, s.id) || '&statement=' || s.id`,
  },
  {
    type: 'discussion_title', label: 'Discussion title', table: 'discussion_threads', column: 'title', idColumn: 'id',
    from: 'discussion_threads t', where: 't.deleted_at IS NULL',
    society: 't.customer_id', author: 't.created_by', href: society('t.customer_id', `/discussions/' || t.id || '`),
  },
  {
    type: 'discussion_post', label: 'Discussion message', table: 'discussion_posts', column: 'body', idColumn: 'id',
    from: 'discussion_posts t JOIN discussion_threads th ON th.id = t.thread_id', where: 't.deleted_at IS NULL AND th.deleted_at IS NULL',
    society: 'th.customer_id', author: 't.created_by', href: society('th.customer_id', `/discussions/' || th.id || '`),
  },
  ...(['title', 'description'] as const).map(c => ({
    type: `document_${c}`, label: `Document ${c}`, table: 'documents', column: c, idColumn: 'id',
    from: 'documents t', where: 't.deleted_at IS NULL',
    society: 't.customer_id', author: 't.uploaded_by',
    href: `'/society/' || t.customer_id || '/documents' || COALESCE('?folder=' || t.folder_id, '')`,
  })),
  {
    type: 'folder_name', label: 'Document folder name', table: 'document_folders', column: 'name', idColumn: 'id',
    from: 'document_folders t', society: 't.customer_id', author: 't.created_by',
    href: `'/society/' || t.customer_id || '/documents?folder=' || t.id`,
  },
  ...(['title', 'description', 'location'] as const).map(c => ({
    type: `event_${c}`, label: `Event ${c}`, table: 'society_events', column: c, idColumn: 'id',
    from: 'society_events t', where: 't.deleted_at IS NULL',
    society: 't.customer_id', author: 't.created_by', href: society('t.customer_id', '/events'),
  })),
  ...(['title', 'body', 'grounding'] as const).map(c => ({
    type: `principle_${c}`, label: `Principle ${c === 'grounding' ? 'reasoning' : c}`, table: 'society_principles', column: c, idColumn: 'id',
    from: 'society_principles t JOIN society_principle_versions v ON v.id = t.version_id', where: 'v.is_current',
    society: 'v.customer_id', author: 'v.created_by', href: society('v.customer_id', '/principles'),
  })),
  {
    type: 'principle_review', label: 'Principle review request', table: 'society_principle_reviews', column: 'request_text', idColumn: 'id',
    from: 'society_principle_reviews t', society: 't.customer_id', author: 't.user_id', href: society('t.customer_id', '/principles'),
  },
  ...(['name', 'description'] as const).map(c => ({
    type: `project_${c}`, label: `Project ${c}`, table: 'projects', column: c, idColumn: 'id',
    from: 'projects t', where: 't.deleted_at IS NULL',
    society: 't.customer_id', author: 't.created_by', href: society('t.customer_id', `/projects/' || t.id || '`),
  })),
  ...(['name', 'description', 'comments'] as const).map(c => ({
    type: `task_${c}`, label: `Task ${c}`, table: 'project_tasks', column: c, idColumn: 'id',
    from: 'project_tasks t JOIN projects p ON p.id = t.project_id', where: 'p.deleted_at IS NULL',
    society: 'p.customer_id', author: 't.created_by', href: society('p.customer_id', `/projects/' || p.id || '`),
  })),
  {
    type: 'status_report', label: 'Task status report', table: 'project_status_reports', column: 'body', idColumn: 'id',
    from: 'project_status_reports t JOIN project_tasks k ON k.id = t.task_id JOIN projects p ON p.id = k.project_id',
    where: 'p.deleted_at IS NULL',
    society: 'p.customer_id', author: 't.user_id', href: society('p.customer_id', `/projects/' || p.id || '?tab=report`),
  },
  ...(['name', 'description'] as const).map(c => ({
    type: `raid_${c}`, label: `RAID item ${c}`, table: 'project_raid', column: c, idColumn: 'id',
    from: 'project_raid t JOIN projects p ON p.id = t.project_id', where: 'p.deleted_at IS NULL',
    society: 'p.customer_id', author: 't.created_by', href: society('p.customer_id', `/projects/' || p.id || '?tab=report`),
  })),
  ...(['name', 'hero_text', 'description'] as const).map(c => ({
    type: `society_${c}`, label: `Society ${c === 'hero_text' ? 'hero text' : c}`, table: 'customers', column: c, idColumn: 'id',
    from: 'customers t', society: 't.id',
    author: `CASE WHEN t.created_by ~* '^[0-9a-f-]{36}$' THEN t.created_by::uuid END`,
    href: `'/scotparl?society=' || t.id`,
  })),
  // Profiles: no Society, so these go to SysAdmin's queue
  ...([['user_full_name', 'display name'], ['user_bio', 'bio']] as const).map(([c, l]) => ({
    type: `user_${c === 'user_bio' ? 'bio' : 'name'}`, label: `Profile ${l}`, table: 'users', column: c, idColumn: 'id',
    from: 'users t', society: 'NULL::int', author: 't.id', href: `NULL::text`,
  })),
];

export const TARGET_BY_TYPE = new Map(SCAN_TARGETS.map(t => [t.type, t]));

export const CONTENT_LABELS: Record<string, string> = Object.fromEntries(SCAN_TARGETS.map(t => [t.type, t.label]));
