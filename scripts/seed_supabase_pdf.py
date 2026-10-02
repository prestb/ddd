import pdfplumber
import re
import json
import os

pdf_path = r'C:\Users\12ELEVEN\OneDrive\Images\apps\DDD Hoshea 2026 - Dated.pdf'
edition_id = '8fdd0b33-6841-4eb8-b39b-181dd7165891'

DAY_RE = re.compile(r'^(?P<weekday>[A-Za-zÀ-ÿ]+(?:day)?(?:\s*\([^)]+\))?)\s+(?P<day>\d{1,2})(?:st|nd|rd|th|er)?$', re.I)
TRANSLATION_TAG_RE = re.compile(r'\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\)', re.I)
BIBLE_FULL_REF_RE = re.compile(r'((?:[1-3]\s*)?[A-ZÀ-ÿ][a-zà-ÿ]{2,15}\s+\d{1,3}[\s:]+\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\))?)', re.I)
SECTION_RE = re.compile(r'^(Declaration|Wisdom Nugget|Further Studies|Prière|Prayer|Déclaration|Pensée de sagesse|Pensee de sagesse|Lectures complémentaires|Pour aller plus loin|Étude approfondie|Etude):?\s*$', re.I)

def clean_lines(text):
    lines = []
    for raw in text.replace("\u291b", "").splitlines():
        value = re.sub(r"\s+", " ", raw.replace("", "")).strip()
        if not value or re.match(r"^(?:DAILY DEW|DEVOTIONAL|SHILOH|PAGE \d+|\d{1,3})$", value, re.I):
            continue
        lines.append(value)
    return lines

def join_lines(lines):
    return " ".join(lines).replace("  ", " ").strip()

def parse_pdf(pdf_file):
    days = []
    with pdfplumber.open(pdf_file) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ''
            lines = clean_lines(text)
            if not lines:
                continue

            heading_match = None
            heading_idx = -1
            for idx in range(min(len(lines), 5)):
                match = DAY_RE.match(lines[idx])
                if match and match.group("day"):
                    heading_match = match
                    heading_idx = idx
                    break

            if not heading_match:
                continue

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

            sections = {"meditation": [], "declaration": [], "wisdom_nugget": [], "further_studies": []}
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
            further = [item.strip(" .;") for item in re.split(r"[,;]", join_lines(sections["further_studies"])) if item.strip()]

            days.append({
                "day_number": day_number,
                "weekday": weekday,
                "title": title,
                "scripture_reference": scripture_ref,
                "scripture_text": scripture_text,
                "meditation": meditation_text,
                "declaration": declaration_text,
                "wisdom_nugget": wisdom_text,
                "further_studies": further,
            })
    return days

days = parse_pdf(pdf_path)
print(f"Parsed {len(days)} devotions from PDF.")

def escape_sql(val):
    if val is None:
        return "NULL"
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"

# Write SQL file
sql_file = "tmp/seed_devotions.sql"
os.makedirs("tmp", exist_ok=True)

with open(sql_file, "w", encoding="utf-8") as f:
    f.write(f"DELETE FROM devotions WHERE edition_id = '{edition_id}';\n")
    f.write(f"UPDATE editions SET status = 'published', updated_at = NOW() WHERE id = '{edition_id}';\n")

    for d in days:
        further_json = escape_sql(json.dumps(d["further_studies"])) + "::jsonb"
        title = escape_sql(d["title"])
        weekday = escape_sql(d["weekday"])
        scripture_ref = escape_sql(d["scripture_reference"])
        scripture_txt = escape_sql(d["scripture_text"])
        meditation = escape_sql(d["meditation"])
        declaration = escape_sql(d["declaration"])
        wisdom = escape_sql(d["wisdom_nugget"])

        f.write(f"""
INSERT INTO devotions (edition_id, day_number, weekday, title, scripture_reference, scripture_text, meditation, declaration, wisdom_nugget, further_studies)
VALUES ('{edition_id}', {d['day_number']}, {weekday}, {title}, {scripture_ref}, {scripture_txt}, {meditation}, {declaration}, {wisdom}, {further_json});
""")

print(f"Generated SQL script at {sql_file}")
