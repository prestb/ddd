import json
import re
import sys
from pathlib import Path


def sql(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate-seed-sql.py INPUT.ts OUTPUT.sql")

    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    payload = source[source.index("= [") + 2 : source.rindex("];" ) + 1]
    entries = json.loads(payload)

    lines = [
        "-- Daily Dew Shiloh July 2026 seed.",
        "-- Run this after supabase-schema.sql in the Supabase SQL Editor.",
        "begin;",
        "",
        "insert into public.editions (slug, title, theme, month, year, language, status, introduction)",
        "values (",
        "  'shiloh-july-2026',",
        "  'Shiloh',",
        "  'Genesis 1:28 Era',",
        "  7, 2026, 'en', 'draft',",
        "  " + sql("The July edition journeys through the blessing, fruitfulness, multiplication, restoration, and dominion of Genesis 1:28."),
        ")",
        "on conflict (slug) do update set updated_at = now();",
        "",
    ]

    for index, entry in enumerate(entries):
        studies = json.dumps(entry["furtherStudies"], ensure_ascii=False)
        lines.extend([
            "insert into public.devotions (edition_id, day_number, weekday, title, scripture_reference, meditation, further_studies, wisdom_nugget, declaration)",
            "select (select id from public.editions where slug = 'shiloh-july-2026'), "
            f"{entry['day']}, {sql(entry['weekday'])}, {sql(entry['title'])}, {sql(entry['scripture'])}, "
            f"{sql(entry['meditation'])}, {sql(studies)}::jsonb, {sql(entry['wisdom'])}, {sql(entry['declaration'])}",
            "on conflict (edition_id, day_number) do update set",
            "  weekday = excluded.weekday, title = excluded.title, scripture_reference = excluded.scripture_reference,",
            "  meditation = excluded.meditation, further_studies = excluded.further_studies,",
            "  wisdom_nugget = excluded.wisdom_nugget, declaration = excluded.declaration;",
        ])

    lines.extend(["", "commit;", ""])
    Path(sys.argv[2]).write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated seed SQL for {len(entries)} daily entries")


if __name__ == "__main__":
    main()
