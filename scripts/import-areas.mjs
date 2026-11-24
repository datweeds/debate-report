// Load GeoNames into the areas table (and refresh it: safe to run again).
//   mkdir -p ~/data/geonames && cd ~/data/geonames
//   for f in cities500.zip admin1CodesASCII.txt admin2Codes.txt countryInfo.txt; do
//     curl -sSO https://download.geonames.org/export/dump/$f; done; unzip -o cities500.zip
//   cd ~/debate-report && node scripts/import-areas.mjs [~/data/geonames]
// Places: populated places of 500+ people. Attribution: GeoNames, CC BY 4.0.
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';

const dir = process.argv[2] ?? path.join(os.homedir(), 'data', 'geonames');
const env = ['.env', '.env.local', '.env.production', '.env.production.local'].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const url = [...env.matchAll(/^DATABASE_URL=["']?([^"'\n]+)/mg)].at(-1)[1];
const db = new pg.Client({ connectionString: url });
await db.connect();

const lines = f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
const rows = [];   // [id, name, ascii, level, parent, path, label, cc, pop]

// Countries
const country = new Map();
for (const l of lines('countryInfo.txt')) {
  const c = l.split('\t');
  country.set(c[0], c[4]);
  rows.push([c[0], c[4], c[4], 'country', null, c[0], c[4], c[0], Number(c[7]) || 0]);
}
// Regions (admin 1), e.g. GB.ENG England
const admin1 = new Map();
for (const l of lines('admin1CodesASCII.txt')) {
  const [code, name, ascii] = l.split('\t');
  const cc = code.split('.')[0];
  if (!country.has(cc)) continue;
  admin1.set(code, name);
  rows.push([code, name, ascii, 'state_county', cc, `${cc}/${code}`, `${name}, ${country.get(cc)}`, cc, 0]);
}
// Counties (admin 2), e.g. GB.ENG.I9 Norfolk
const admin2 = new Map();
for (const l of lines('admin2Codes.txt')) {
  const [code, name, ascii] = l.split('\t');
  const [cc, a1] = code.split('.');
  const p1 = `${cc}.${a1}`;
  if (!admin1.has(p1)) continue;
  admin2.set(code, name);
  rows.push([code, name, ascii, 'state_county', p1, `${cc}/${p1}/${code}`, `${name}, ${admin1.get(p1)}`, cc, 0]);
}
// Places
for (const l of lines('cities500.txt')) {
  const c = l.split('\t');
  const [id, name, ascii] = c;
  if (c[6] !== 'P') continue;
  const cc = c[8], a1 = c[10], a2 = c[11], pop = Number(c[14]) || 0;
  if (!country.has(cc)) continue;
  const p1 = a1 ? `${cc}.${a1}` : null, p2 = p1 && a2 ? `${p1}.${a2}` : null;
  const chain = [cc, p1 && admin1.has(p1) ? p1 : null, p2 && admin2.has(p2) ? p2 : null].filter(Boolean);
  const label = [name, chain[2] ? admin2.get(chain[2]) : null, chain[1] ? admin1.get(chain[1]) : country.get(cc)]
    .filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
  rows.push([id, name, ascii, pop >= 100000 ? 'city' : 'town', chain.at(-1), [...chain, id].join('/'), label, cc, pop]);
}

console.log(`${rows.length} areas`);
for (let i = 0; i < rows.length; i += 2000) {
  const b = rows.slice(i, i + 2000);
  const col = k => b.map(r => r[k]);
  await db.query(
    `INSERT INTO areas (id, name, ascii_name, level, parent_id, path, label, country_code, population)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::int[])
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, ascii_name = EXCLUDED.ascii_name, level = EXCLUDED.level,
       parent_id = EXCLUDED.parent_id, path = EXCLUDED.path, label = EXCLUDED.label, country_code = EXCLUDED.country_code,
       population = EXCLUDED.population`,
    [col(0), col(1), col(2), col(3), col(4), col(5), col(6), col(7), col(8)]);
}
console.log('done');
await db.end();
