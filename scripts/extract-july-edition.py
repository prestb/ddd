import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


DAY_RE = re.compile(r"(Wondersday|Triumphday|Faithday|Sabbathday|Sacredday|Mercyday|Truthday)\s+([0-9]+)\s*(?:st|nd|rd|th)?", re.I)
DAILY_PAGES = list(range(11, 18)) + list(range(19, 27)) + list(range(28, 44))


def clean(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    return value


def repair_initial(value: str) -> str:
    replacements = {
        "ne of": "One of",
        "ruitfulness": "Fruitfulness",
        "od never": "God never",
        "he command": "The command",
        "he word": "The word",
        "ominion": "Dominion",
        "very branch": "Every branch",
        "he blessing": "The blessing",
        "od’s Kingdom": "God’s Kingdom",
        "efore sin": "Before sin",
        "od's command": "God's command",
        "ncrease is": "Increase is",
        "efore God": "Before God",
        "od's desire": "God's desire",
        "rom the beginning": "From the beginning",
        "ne of the greatest": "One of the greatest",
        "he human body": "The human body",
        "ne of the greatest mysteries": "One of the greatest mysteries",
        "ne of God's": "One of God's",
        "ne of the most": "One of the most",
        "ne of God's hidden": "One of God's hidden",
        "ne of the subtle": "One of the subtle",
        "od's blessing": "God's blessing",
        "ne of the greatest misconceptions": "One of the greatest misconceptions",
        "od never intended": "God never intended",
        "ne of God's greatest gifts": "One of God's greatest gifts",
        "ne of the most subtle": "One of the most subtle",
        "rue dominion": "True dominion",
        "enesis 1:28": "Genesis 1:28",
    }
    for source, target in replacements.items():
        if value.startswith(source):
            return target + value[len(source):]
    return value


def parse_page(text: str) -> dict | None:
    match = DAY_RE.search(text)
    if not match:
        return None

    section = text[match.start():]
    lines = section.splitlines()
    if len(lines) > 1 and clean(lines[1]).lower() in {"st", "nd", "rd", "th"}:
        lines[0] = f"{lines[0]} {clean(lines[1])}"
        lines.pop(1)
    while len(lines) > 1 and not clean(lines[1]):
        lines.pop(1)
    header = clean(lines[0])
    title = clean(lines[1])
    remainder = "\n".join(lines[2:])
    verse, body_and_sections = re.split(r"\n\s*\n", remainder, maxsplit=1)
    further_index = body_and_sections.find("Further Studies")
    body = re.sub(r"\s+[A-Z]$", "", body_and_sections[:further_index].strip())
    sections = body_and_sections[further_index:]

    studies_match = re.search(r"Further Studies\s+(.*?)\s+Wisdom Nugget", sections, re.S)
    wisdom_match = re.search(r"Wisdom Nugget\s+(.*?)\s+Declaration", sections, re.S)
    declaration_match = re.search(r"Declaration\s+(.*)$", sections, re.S)
    if not (studies_match and wisdom_match and declaration_match):
        raise ValueError(f"Could not parse sections for {title}")

    return {
        "day": int(match.group(2)),
        "weekday": header,
        "title": title,
        "scripture": clean(verse),
        "preview": clean(repair_initial(body))[:220],
        "meditation": clean(repair_initial(body)),
        "furtherStudies": [clean(item) for item in re.split(r",\s*", studies_match.group(1)) if clean(item)],
        "wisdom": clean(wisdom_match.group(1)),
        "declaration": clean(declaration_match.group(1)),
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract-july-edition.py INPUT.pdf OUTPUT.ts")

    reader = PdfReader(sys.argv[1])
    entries = [parse_page(reader.pages[index].extract_text() or "") for index in DAILY_PAGES]
    entries = [entry for entry in entries if entry]
    if len(entries) != 31:
        raise ValueError(f"Expected 31 daily entries, found {len(entries)}")

    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    output = "import type { Devotion } from './devotions';\n\nexport const SHILOH_JULY_2026: Devotion[] = " + payload + ";\n"
    Path(sys.argv[2]).write_text(output, encoding="utf-8")
    print(f"Extracted {len(entries)} daily entries to {sys.argv[2]}")


if __name__ == "__main__":
    main()
