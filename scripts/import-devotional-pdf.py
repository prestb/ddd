"""Extract Daily Dew-style devotional pages into a reviewable JSON draft.

Tested and validated on official Daily Dew PDF layouts (e.g. DDD Hoshea 2026 - Dated.pdf).
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber

DAY_RE = re.compile(
    r"^(?P<weekday>[A-Za-zÀ-ÿ]+(?:day)?(?:\s*\([^)]+\))?)\s+(?P<day>\d{1,2})(?:st|nd|rd|th|er)?$",
    re.I,
)
TRANSLATION_TAG_RE = re.compile(
    r"\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\)", re.I
)
BIBLE_FULL_REF_RE = re.compile(
    r"((?:[1-3]\s*)?[A-ZÀ-ÿ][a-zà-ÿ]{2,15}\s+\d{1,3}[\s:]+\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\))?)",
    re.I,
)
SECTION_RE = re.compile(
    r"^(Declaration|Wisdom Nugget|Further Studies|Prière|Prayer|Déclaration|Pensée de sagesse|Pensee de sagesse|Lectures complémentaires|Pour aller plus loin|Étude approfondie|Etude):?\s*$",
    re.I,
)


def clean_lines(text: str) -> list[str]:
    lines = []
    for raw in text.replace("\u291b", "").splitlines():
        value = re.sub(r"\s+", " ", raw.replace("", "")).strip()
        if not value or re.match(r"^(?:DAILY DEW|DEVOTIONAL|SHILOH|PAGE \d+|\d{1,3})$", value, re.I):
            continue
        lines.append(value)
    return lines


def join_lines(lines: list[str]) -> str:
    return " ".join(lines).replace("  ", " ").strip()


def parse_day(page_number: int, lines: list[str]) -> dict | None:
    if not lines:
        return None

    heading_match = None
    heading_idx = -1

    for idx in range(min(len(lines), 5)):
        match = DAY_RE.match(lines[idx])
        if match and match.group("day"):
            heading_match = match
            heading_idx = idx
            break

    if not heading_match:
        return None

    day_number = int(heading_match.group("day"))
    weekday = heading_match.group("weekday").strip()
    title = lines[heading_idx + 1] if heading_idx + 1 < len(lines) else "Daily Meditation"

    cursor = heading_idx + 2
    scripture_lines = []

    while cursor < len(lines):
        line = lines[cursor]
        if SECTION_RE.match(line):
            break
        scripture_lines.append(line)
        cursor += 1
        if TRANSLATION_TAG_RE.search(line):
            break

    scripture_text = join_lines(scripture_lines)
    ref_match = BIBLE_FULL_REF_RE.search(scripture_text)
    scripture_ref = ref_match.group(0) if ref_match else ""

    sections: dict[str, list[str]] = {
        "meditation": [],
        "declaration": [],
        "wisdom_nugget": [],
        "further_studies": [],
    }

    current_sec = "meditation"
    while cursor < len(lines):
        line = lines[cursor]
        sec_match = SECTION_RE.match(line)
        if sec_match:
            raw_name = sec_match.group(1).lower()
            if "declaration" in raw_name or "déclaration" in raw_name:
                current_sec = "declaration"
            elif "wisdom" in raw_name or "sagesse" in raw_name:
                current_sec = "wisdom_nugget"
            elif "further" in raw_name or "étude" in raw_name or "etude" in raw_name or "lectures" in raw_name:
                current_sec = "further_studies"
            else:
                current_sec = "meditation"
            cursor += 1
            continue

        sections[current_sec].append(line)
        cursor += 1

    meditation_text = join_lines(sections["meditation"])
    declaration_text = join_lines(sections["declaration"])
    wisdom_text = join_lines(sections["wisdom_nugget"])
    further = [
        item.strip(" .;")
        for item in re.split(r"[,;]", join_lines(sections["further_studies"]))
        if item.strip()
    ]

    return {
        "source_page": page_number,
        "day_number": day_number,
        "weekday": weekday,
        "title": title,
        "scripture_reference": scripture_ref,
        "scripture_text": scripture_text,
        "meditation": meditation_text,
        "declaration": declaration_text,
        "wisdom_nugget": wisdom_text,
        "further_studies": further,
        "needs_review": not scripture_ref or not meditation_text or not declaration_text,
    }


def extract(pdf_path: Path) -> dict:
    days = []
    skipped_pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for number, page in enumerate(pdf.pages, start=1):
            parsed = parse_day(number, clean_lines(page.extract_text() or ""))
            if parsed:
                days.append(parsed)
            elif number > 5:
                skipped_pages.append(number)
    return {
        "source_file": pdf_path.name,
        "source_pages": len(pdf.pages),
        "days_found": len(days),
        "needs_review": any(d["needs_review"] for d in days),
        "days": days,
        "skipped_pages": skipped_pages,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=Path("tmp/devotional-import.json"))
    args = parser.parse_args()
    result = extract(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    review_count = sum(1 for day in result["days"] if day["needs_review"])
    print(f"Found {result['days_found']} day records across {result['source_pages']} pages.")
    print(f"Needs editorial review: {review_count} records.")
    print(f"Review draft written to {args.output}")


if __name__ == "__main__":
    main()
