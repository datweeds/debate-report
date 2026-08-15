#!/usr/bin/env python3
"""
Extract SP division votes from parlparse parsed XML files.

Reads the XML files produced by:
    poetry run python -m pyscraper.sp_2024 debates --download --parse ...

Outputs a SQL file ready to load into the debate_report database.

Usage:
    python extract_sp_divisions.py \
        --parsed-dir ~/parldata/cmpages/sp_2024/parsed \
        --bills bills.json \
        --members members.json \
        --output sp_divisions.sql

Generating the input JSON files (run from this project directory):
    ssh devuser@194.163.173.19 "psql -d debate_report -t -A \
        -c 'SELECT json_agg(row_to_json(t)) FROM (SELECT id, short_name FROM sp_bills) t'" \
        > bills.json
    ssh devuser@194.163.173.19 "psql -d debate_report -t -A \
        -c 'SELECT json_agg(row_to_json(t)) FROM (SELECT person_id, parliamentary_name, preferred_name FROM sp_members) t'" \
        > members.json
"""

import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


HONORIFICS = {'dr', 'mr', 'mrs', 'ms', 'prof', 'professor', 'sir', 'lord', 'lady', 'rev'}


def norm_name(s: str) -> str:
    words = s.lower().split()
    while words and words[0].rstrip('.') in HONORIFICS:
        words.pop(0)
    return ' '.join(words)


def parse_msp_display_name(raw: str) -> str:
    """
    "Adam, Karen (Banffshire and Buchan Coast) (SNP)"  →  "karen adam"
    """
    name = re.sub(r'\s*\([^)]+\)', '', raw).strip()  # strip "(Constituency) (Party)"
    parts = name.split(',', 1)
    if len(parts) == 2:
        surname, first = parts[0].strip(), parts[1].strip()
        return norm_name(f"{first} {surname}")
    return norm_name(name)


def build_member_map(members: list) -> dict:
    """normalised "firstname surname" → person_id"""
    name_map = {}
    for m in members:
        parl = m['parliamentary_name']
        preferred = m.get('preferred_name') or ''
        parts = parl.split(',', 1)
        surname = norm_name(parts[0].strip()) if parts else ''
        first = norm_name(preferred.strip() or (parts[1].strip() if len(parts) > 1 else ''))
        if first and surname:
            name_map[f"{first} {surname}"] = m['person_id']
    return name_map


def match_bill(title: str, bills: list):
    """
    Return the bill whose short_name best (longest) matches the agenda item title.
    Typical title: "Housing (Scotland) Bill: Stage 3"
    """
    title_lower = title.lower()
    best, best_len = None, 0
    for bill in bills:
        name = bill['short_name'].lower()
        if name and name in title_lower and len(name) > best_len:
            best, best_len = bill, len(name)
    return best


def extract_divisions(parsed_dir: Path, bills: list, member_map: dict) -> list:
    divisions = []
    files = sorted(parsed_dir.glob('*.xml'))
    print(f"Processing {len(files)} XML files…")

    for xml_file in files:
        with xml_file.open(encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        committee = soup.find('committee')
        if not committee:
            continue

        date_str = committee.get('date', '')

        for item in committee.find_all('agenda_item'):
            title = item.get('title', '').strip()
            url   = item.get('url', '')

            for div in item.find_all('division'):
                count_el = div.find('divisioncount')
                if not count_el:
                    continue

                for_count     = int(count_el.get('for', 0))
                against_count = int(count_el.get('against', 0))
                abstain_count = int(count_el.get('abstentions', 0))

                # Skip trivially empty divisions (can occur on procedural items)
                if for_count + against_count + abstain_count == 0:
                    continue

                matched_bill = match_bill(title, bills)

                per_msp = []
                for mspname_el in div.find_all('mspname'):
                    raw  = mspname_el.get_text(strip=True)
                    norm = parse_msp_display_name(raw)
                    per_msp.append({
                        'raw_name':  raw,
                        'person_id': member_map.get(norm),
                        'vote':      mspname_el.get('vote', ''),
                    })

                divisions.append({
                    'date':          date_str,
                    'title':         title,
                    'url':           url,
                    'for_count':     for_count,
                    'against_count': against_count,
                    'abstain_count': abstain_count,
                    'bill_id':       matched_bill['id'] if matched_bill else None,
                    'bill_name':     matched_bill['short_name'] if matched_bill else None,
                    'votes':         per_msp,
                })

    return divisions


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def generate_sql(divisions: list, output_path: str):
    lines = [
        "BEGIN;",
        "",
        "-- Clear existing data (re-run safe)",
        "TRUNCATE sp_division_votes;",
        "TRUNCATE sp_divisions CASCADE;",
        "",
        "-- Temporarily disable sequence reset issues",
        "ALTER SEQUENCE sp_divisions_id_seq RESTART WITH 1;",
        "",
    ]

    for div_id, d in enumerate(divisions, start=1):
        bill_id  = str(d['bill_id']) if d['bill_id'] else 'NULL'
        url_sql  = sql_str(d['url'])
        title_sql = sql_str(d['title'])

        lines.append(
            f"INSERT INTO sp_divisions (id, date, title, for_count, against_count, abstain_count, sp_bill_id, source_url) "
            f"VALUES ({div_id}, {sql_str(d['date'])}, {title_sql}, "
            f"{d['for_count']}, {d['against_count']}, {d['abstain_count']}, {bill_id}, {url_sql});"
        )

        for v in d['votes']:
            pid      = str(v['person_id']) if v['person_id'] else 'NULL'
            name_sql = sql_str(v['raw_name'])
            vote_sql = sql_str(v['vote'])
            lines.append(
                f"INSERT INTO sp_division_votes (division_id, person_id, msp_name, vote) "
                f"VALUES ({div_id}, {pid}, {name_sql}, {vote_sql});"
            )

    lines += ["", "COMMIT;"]

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def main():
    parser = argparse.ArgumentParser(description="Extract SP divisions from parlparse XML")
    parser.add_argument('--parsed-dir', required=True, help='~/parldata/cmpages/sp_2024/parsed')
    parser.add_argument('--bills',      required=True, help='bills.json from server')
    parser.add_argument('--members',    required=True, help='members.json from server')
    parser.add_argument('--output',     default='sp_divisions.sql')
    parser.add_argument('--dry-run',    action='store_true', help='Report matches without writing SQL')
    args = parser.parse_args()

    with open(args.bills, encoding='utf-8') as f:
        bills = json.load(f)
    with open(args.members, encoding='utf-8') as f:
        members_raw = json.load(f)

    member_map = build_member_map(members_raw)
    print(f"Loaded {len(bills)} bills, {len(member_map)} members")

    divisions = extract_divisions(Path(args.parsed_dir).expanduser(), bills, member_map)

    matched   = [d for d in divisions if d['bill_id']]
    unmatched = [d for d in divisions if not d['bill_id']]

    # Per-MSP match stats
    total_votes    = sum(len(d['votes']) for d in divisions)
    resolved_votes = sum(1 for d in divisions for v in d['votes'] if v['person_id'])

    print(f"\n{'='*50}")
    print(f"Divisions found:       {len(divisions)}")
    print(f"  Matched to a bill:   {len(matched)}")
    print(f"  Unmatched:           {len(unmatched)}")
    print(f"MSP vote records:      {total_votes}")
    print(f"  Person ID resolved:  {resolved_votes} ({100*resolved_votes//max(total_votes,1)}%)")
    print(f"{'='*50}")

    if unmatched:
        print(f"\nUnmatched division titles ({min(20, len(unmatched))} of {len(unmatched)}):")
        for d in unmatched[:20]:
            print(f"  {d['date']}  {d['for_count']}F/{d['against_count']}A — {d['title'][:80]}")

    if not args.dry_run:
        generate_sql(divisions, args.output)
        print(f"\nSQL written to {args.output}")
        print(f"\nTo load on server:")
        print(f"  scp {args.output} devuser@194.163.173.19:/tmp/")
        print(f"  ssh devuser@194.163.173.19 'psql -d debate_report -f /tmp/{Path(args.output).name}'")


if __name__ == '__main__':
    main()
