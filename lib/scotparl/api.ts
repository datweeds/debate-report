const BASE    = 'https://data.parliament.scot/api';
const LEG_BASE = 'https://www.legislation.gov.uk';

async function fetchCollection<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SP API ${path}: HTTP ${res.status}`);
  return res.json();
}

export type SpSession       = { ID: number; ShortName: string; Name: string; StartDate: string; EndDate: string | null };
export type SpParty         = { ID: number; Abbreviation: string; ActualName: string; PreferredName: string; ValidFromDate: string; ValidUntilDate: string | null };
export type SpBillType      = { ID: number; Name: string };
export type SpBillStageType = { ID: number; Name: string; BillTypeID: number; Sequence: number };
export type SpCommittee     = { ID: number; ShortName: string; Name: string; Description: string; ValidFromDate: string; ValidUntilDate: string | null };
export type SpMember        = { PersonID: number; ParliamentaryName: string; PreferredName: string; PhotoURL: string; IsCurrent: boolean; GenderTypeID: number; Notes: string };
export type SpMemberParty   = { ID: number; PersonID: number; PartyID: number; ValidFromDate: string; ValidUntilDate: string | null };
export type SpBill          = { ID: number; Reference: string; ShortName: string; FullName: string; BillTypeID: number; PersonID: number | null; ThirdPartyOrganisation: string | null };
export type SpBillStage     = { ID: number; BillID: number; BillStageTypeID: number; StageDate: string };

export const fetchSessions       = () => fetchCollection<SpSession>('Sessions');
export const fetchParties        = () => fetchCollection<SpParty>('Parties');
export const fetchBillTypes      = () => fetchCollection<SpBillType>('BillTypes');
export const fetchBillStageTypes = () => fetchCollection<SpBillStageType>('BillStageTypes');
export const fetchCommittees     = () => fetchCollection<SpCommittee>('Committees');
export const fetchMembers        = () => fetchCollection<SpMember>('Members');
export const fetchMemberParties  = () => fetchCollection<SpMemberParty>('MemberParties');
export const fetchBills          = () => fetchCollection<SpBill>('Bills');
export const fetchBillStages     = () => fetchCollection<SpBillStage>('BillStages');

// ── Scottish Statutory Instruments (legislation.gov.uk) ───────────────────────

export type SpSsi = {
  year:      number;
  number:    number;
  title:     string;
  url:       string;
  pdf_url:   string | null;
  enacted_at: string | null; // YYYY-MM-DD
};

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 10)));
}

function parseAtomEntries(xml: string): SpSsi[] {
  const results: SpSsi[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title  = /<title[^>]*>([^<]*)<\/title>/.exec(block)?.[1];
    const yearV  = /<ukm:Year Value="(\d+)"/.exec(block)?.[1];
    const numV   = /<ukm:Number Value="(\d+)"/.exec(block)?.[1];
    const upd    = /<updated>([^<T]+)/.exec(block)?.[1];
    const url    = /<link href="([^"]+\/ssi\/[^"]+\/made)"/.exec(block)?.[1]
                ?? /<link href="([^"]+\/ssi\/[^"]+)"/.exec(block)?.[1];
    const pdf    = /<link [^>]*type="application\/pdf"[^>]*href="([^"]+)"/.exec(block)?.[1];
    if (!title || !yearV || !numV) continue;
    const year = parseInt(yearV, 10);
    const number = parseInt(numV, 10);
    results.push({
      year,
      number,
      title: decodeXml(title),
      url: url ?? `${LEG_BASE}/ssi/${year}/${number}/made`,
      pdf_url: pdf ?? null,
      enacted_at: upd ? upd.trim() : null,
    });
  }
  return results;
}

export async function fetchSSIsForYear(year: number): Promise<SpSsi[]> {
  const all: SpSsi[] = [];
  let page = 1;
  while (true) {
    const url = `${LEG_BASE}/ssi/${year}/data.feed?results-count=500${page > 1 ? `&page=${page}` : ''}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) break;
    const xml = await res.text();
    const entries = parseAtomEntries(xml);
    all.push(...entries);
    const hasNext = /<link[^>]+rel="next"/.test(xml);
    if (!hasNext) break;
    page++;
    if (page > 10) break; // safety
  }
  return all;
}
