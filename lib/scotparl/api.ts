const BASE = 'https://data.parliament.scot/api';

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
