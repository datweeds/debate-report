const SPARQL = 'https://query.wikidata.org/sparql';

// Q106762836 = Member of the 6th Scottish Parliament (current session, S6)
const QUERY = `
SELECT DISTINCT ?person ?personLabel ?constituency ?constituencyLabel WHERE {
  ?person p:P39 ?stmt .
  ?stmt ps:P39 wd:Q106762836 .
  OPTIONAL { ?stmt pq:P768 ?constituency }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
} ORDER BY ?personLabel`;

type WdRow = {
  person: { value: string };
  personLabel: { value: string };
  constituency?: { value: string };
  constituencyLabel?: { value: string };
};

export type WdConstituency = {
  personQid: string;
  personLabel: string;
  constituencyQid: string | null;
  constituencyName: string | null;
};

export async function fetchMspConstituencies(): Promise<WdConstituency[]> {
  const url = `${SPARQL}?format=json&query=${encodeURIComponent(QUERY)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'debate.report/1.0 (contact@debate.report)', Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL HTTP ${res.status}`);
  const data = await res.json();
  return (data.results.bindings as WdRow[]).map(r => ({
    personQid:        r.person.value.split('/').at(-1)!,
    personLabel:      r.personLabel.value,
    constituencyQid:  r.constituency?.value.split('/').at(-1) ?? null,
    constituencyName: r.constituencyLabel?.value ?? null,
  }));
}
