import { type PoolClient } from 'pg';
import pool from '@/lib/db';
import {
  fetchSessions, fetchParties, fetchBillTypes, fetchBillStageTypes,
  fetchCommittees, fetchMembers, fetchMemberParties, fetchBills, fetchBillStages,
  fetchSSIsForYear, fetchActsForYear,
} from './api';
import { fetchMspConstituencies } from './wikidata';

type SyncResult = { collection: string; count: number; error?: string };

async function syncOne<T>(
  name: string,
  fetcher: () => Promise<T[]>,
  inserter: (client: PoolClient, rows: T[]) => Promise<void>,
): Promise<SyncResult> {
  const client = await pool.connect();
  try {
    const rows = await fetcher();
    await client.query('BEGIN');
    await inserter(client, rows);
    await client.query(
      `INSERT INTO sp_sync_log (collection, record_count) VALUES ($1, $2)`,
      [name, rows.length]
    );
    await client.query('COMMIT');
    return { collection: name, count: rows.length };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const error = String(err);
    await pool.query(
      `INSERT INTO sp_sync_log (collection, record_count, error) VALUES ($1, 0, $2)`,
      [name, error]
    );
    return { collection: name, count: 0, error };
  } finally {
    client.release();
  }
}

export async function syncAll(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Order matters: lookup tables before their referencing tables
  results.push(await syncOne('sessions', fetchSessions, async (c, rows) => {
    await c.query('TRUNCATE sp_sessions RESTART IDENTITY CASCADE');
    for (const r of rows) {
      await c.query(
        `INSERT INTO sp_sessions (id, short_name, name, start_date, end_date) VALUES ($1,$2,$3,$4,$5)`,
        [r.ID, r.ShortName, r.Name, r.StartDate, r.EndDate]
      );
    }
  }));

  results.push(await syncOne('parties', fetchParties, async (c, rows) => {
    await c.query('TRUNCATE sp_parties RESTART IDENTITY CASCADE');
    for (const r of rows) {
      await c.query(
        `INSERT INTO sp_parties (id, abbreviation, actual_name, preferred_name, valid_from, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.ID, r.Abbreviation || null, r.ActualName, r.PreferredName, r.ValidFromDate, r.ValidUntilDate]
      );
    }
  }));

  results.push(await syncOne('bill_types', fetchBillTypes, async (c, rows) => {
    await c.query('TRUNCATE sp_bill_types RESTART IDENTITY CASCADE');
    for (const r of rows) {
      await c.query(`INSERT INTO sp_bill_types (id, name) VALUES ($1,$2)`, [r.ID, r.Name]);
    }
  }));

  results.push(await syncOne('bill_stage_types', fetchBillStageTypes, async (c, rows) => {
    await c.query('TRUNCATE sp_bill_stage_types RESTART IDENTITY CASCADE');
    for (const r of rows) {
      await c.query(
        `INSERT INTO sp_bill_stage_types (id, name, bill_type_id, sequence) VALUES ($1,$2,$3,$4)`,
        [r.ID, r.Name, r.BillTypeID, r.Sequence]
      );
    }
  }));

  results.push(await syncOne('committees', fetchCommittees, async (c, rows) => {
    await c.query('TRUNCATE sp_committees RESTART IDENTITY CASCADE');
    for (const r of rows) {
      await c.query(
        `INSERT INTO sp_committees (id, short_name, name, description, valid_from, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.ID, r.ShortName || null, r.Name, r.Description || null, r.ValidFromDate, r.ValidUntilDate]
      );
    }
  }));

  // Members before member_parties
  results.push(await syncOne('members', fetchMembers, async (c, rows) => {
    await c.query('TRUNCATE sp_member_parties RESTART IDENTITY CASCADE');
    await c.query('TRUNCATE sp_members RESTART IDENTITY CASCADE');
    for (const r of rows) {
      await c.query(
        `INSERT INTO sp_members (person_id, parliamentary_name, preferred_name, photo_url, is_current, gender_type_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.PersonID, r.ParliamentaryName, r.PreferredName || null, r.PhotoURL || null,
         r.IsCurrent, r.GenderTypeID, r.Notes || null]
      );
    }
  }));

  results.push(await syncOne('member_parties', fetchMemberParties, async (c, rows) => {
    for (const r of rows) {
      await c.query(
        `INSERT INTO sp_member_parties (id, person_id, party_id, valid_from, valid_until)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [r.ID, r.PersonID, r.PartyID, r.ValidFromDate, r.ValidUntilDate]
      );
    }
  }));

  // Bills before stages — null out sponsor IDs not in our member set
  const memberIdRes = await pool.query('SELECT person_id FROM sp_members');
  const memberIds = new Set<number>(memberIdRes.rows.map((r: { person_id: number }) => r.person_id));

  results.push(await syncOne('bills', fetchBills, async (c, rows) => {
    await c.query('TRUNCATE sp_bill_stages RESTART IDENTITY CASCADE');
    await c.query('TRUNCATE sp_bills RESTART IDENTITY CASCADE');
    for (const r of rows) {
      const personId = r.PersonID && memberIds.has(r.PersonID) ? r.PersonID : null;
      await c.query(
        `INSERT INTO sp_bills (id, reference, short_name, full_name, bill_type_id, person_id, third_party_organisation)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.ID, r.Reference || null, r.ShortName, r.FullName,
         r.BillTypeID || null, personId, r.ThirdPartyOrganisation || null]
      );
    }
  }));

  results.push(await syncOne('bill_stages', fetchBillStages, async (c, rows) => {
    const billIdRes = await c.query('SELECT id FROM sp_bills');
    const billIds = new Set<number>(billIdRes.rows.map((r: { id: number }) => r.id));
    for (const r of rows.filter(s => billIds.has(s.BillID))) {
      await c.query(
        `INSERT INTO sp_bill_stages (id, bill_id, bill_stage_type_id, stage_date)
         VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [r.ID, r.BillID, r.BillStageTypeID || null, r.StageDate]
      );
    }
  }));

  // Wikidata constituency sync — runs after SP data is current
  results.push(await syncWikidata());

  // SSI sync — last 5 years by default
  results.push(await syncSSIs());

  // Acts sync — all years since devolution (1999), then keep current year fresh
  results.push(await syncActs());

  return results;
}

export async function syncSSIs(years?: number[]): Promise<SyncResult> {
  const currentYear = new Date().getFullYear();
  const targetYears = years ?? Array.from({ length: 5 }, (_, i) => currentYear - i);
  let totalCount = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const year of targetYears) {
      const rows = await fetchSSIsForYear(year);
      for (const r of rows) {
        await client.query(
          `INSERT INTO sp_ssis (year, number, title, url, pdf_url, enacted_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (year, number) DO UPDATE SET
             title      = EXCLUDED.title,
             url        = EXCLUDED.url,
             pdf_url    = EXCLUDED.pdf_url,
             enacted_at = EXCLUDED.enacted_at`,
          [r.year, r.number, r.title, r.url, r.pdf_url, r.enacted_at]
        );
        totalCount++;
      }
    }
    await client.query(
      `INSERT INTO sp_sync_log (collection, record_count) VALUES ('ssis', $1)`,
      [totalCount]
    );
    await client.query('COMMIT');
    return { collection: 'ssis', count: totalCount };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const error = String(err);
    await pool.query(
      `INSERT INTO sp_sync_log (collection, record_count, error) VALUES ('ssis', 0, $1)`,
      [error]
    ).catch(() => {});
    return { collection: 'ssis', count: 0, error };
  } finally {
    client.release();
  }
}

export async function syncActs(years?: number[]): Promise<SyncResult> {
  const currentYear = new Date().getFullYear();
  // Default: full backfill since devolution (1999)
  const targetYears = years ?? Array.from({ length: currentYear - 1998 }, (_, i) => currentYear - i);
  let totalCount = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const year of targetYears) {
      const rows = await fetchActsForYear(year);
      for (const r of rows) {
        await client.query(
          `INSERT INTO sp_acts (year, number, title, url, pdf_url, enacted_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (year, number) DO UPDATE SET
             title      = EXCLUDED.title,
             url        = EXCLUDED.url,
             pdf_url    = EXCLUDED.pdf_url,
             enacted_at = EXCLUDED.enacted_at`,
          [r.year, r.number, r.title, r.url, r.pdf_url, r.enacted_at]
        );
        totalCount++;
      }
    }
    await client.query(
      `INSERT INTO sp_sync_log (collection, record_count) VALUES ('acts', $1)`,
      [totalCount]
    );
    await client.query('COMMIT');
    return { collection: 'acts', count: totalCount };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const error = String(err);
    await pool.query(
      `INSERT INTO sp_sync_log (collection, record_count, error) VALUES ('acts', 0, $1)`,
      [error]
    ).catch(() => {});
    return { collection: 'acts', count: 0, error };
  } finally {
    client.release();
  }
}

export async function syncWikidata(): Promise<SyncResult> {
  try {
    const constituencies = await fetchMspConstituencies();

    // Fetch all MSPs from DB and build name → person_id map
    // Note: is_current is unreliable in SP API data; Wikidata filters to S6 MSPs
    const { rows: members } = await pool.query<{
      person_id: number;
      parliamentary_name: string;
      preferred_name: string | null;
    }>('SELECT person_id, parliamentary_name, preferred_name FROM sp_members');

    const HONORIFICS = new Set(['dr', 'mr', 'mrs', 'ms', 'prof', 'professor', 'sir', 'lord', 'lady', 'rev']);
    const normName = (s: string) => {
      const words = s.toLowerCase().split(/\s+/);
      while (words.length && HONORIFICS.has(words[0].replace('.', ''))) words.shift();
      return words.join(' ');
    };

    const nameMap = new Map<string, number>();
    for (const m of members) {
      const parts = m.parliamentary_name.split(',');
      const surname = normName(parts[0]?.trim() ?? '');
      const first = normName(m.preferred_name?.trim() ?? parts[1]?.trim() ?? '');
      if (first && surname) nameMap.set(`${first} ${surname}`, m.person_id);
      if (!m.parliamentary_name.includes(',')) nameMap.set(normName(m.parliamentary_name), m.person_id);
    }

    let matched = 0;
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      // Clear and re-populate (the TRUNCATE CASCADE on sp_members already cleared this,
      // but handle the wikidata-only re-sync case too)
      await client.query('TRUNCATE sp_member_constituencies');
      for (const c of constituencies) {
        if (!c.constituencyName) continue;
        const personId = nameMap.get(normName(c.personLabel));
        if (!personId) continue;
        await client.query(
          `INSERT INTO sp_member_constituencies
             (person_id, constituency_name, wikidata_person_qid, wikidata_constituency_qid)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (person_id) DO UPDATE SET
             constituency_name         = EXCLUDED.constituency_name,
             wikidata_person_qid       = EXCLUDED.wikidata_person_qid,
             wikidata_constituency_qid = EXCLUDED.wikidata_constituency_qid`,
          [personId, c.constituencyName, c.personQid, c.constituencyQid]
        );
        matched++;
      }
      await client.query(
        `INSERT INTO sp_sync_log (collection, record_count) VALUES ('wikidata_constituencies', $1)`,
        [matched]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    return { collection: 'wikidata_constituencies', count: matched };
  } catch (err) {
    const error = String(err);
    await pool.query(
      `INSERT INTO sp_sync_log (collection, record_count, error) VALUES ('wikidata_constituencies', 0, $1)`,
      [error]
    ).catch(() => {});
    return { collection: 'wikidata_constituencies', count: 0, error };
  }
}
