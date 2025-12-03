#!/usr/bin/env python3
import pandas as pd
import json
import os
from datetime import datetime

# SUPER SIMPLE & BULLETPROOF PATHS – works everywhere
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FOLDER = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "CSV"))
OUTPUT_JSON = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "all_calls.json"))

DATE_FORMAT_IN_CSV = "%m/%d/%Y %H:%M"
FINAL_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Debug prints (you can delete them later)
print(f"Looking for CSVs in: {CSV_FOLDER}")
print(f"Writing JSON to: {OUTPUT_JSON}")

os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

final_calls = {"calls": {}}
total = 0

if not os.path.exists(CSV_FOLDER):
    print(f"ERROR: CSV folder not found at {CSV_FOLDER}")
    exit(1)

for filename in sorted(f for f in os.listdir(CSV_FOLDER) if f.lower().endswith(".csv")):
    date_key = os.path.splitext(filename)[0]
    print(f"Processing {filename}")

    filepath = os.path.join(CSV_FOLDER, filename)
    df = None
    for enc in ["cp1252", "utf-8-sig", "latin1", "utf-8"]:
        try:
            df = pd.read_csv(filepath, encoding=enc)
            break
        except Exception as e:
            continue
    if df is None:
        print(f"  → Could not read {filename}")
        continue

    df.columns = df.columns.str.strip().str.lower().str.replace(r"\s+", "_", regex=True)
    final_calls["calls"].setdefault(date_key, {})

    for _, row in df.iterrows():
        total += 1
        phone = str(row.get("phone_number", "")).strip()
        raw_date = row.get("call_date")

        call_id = f"{date_key}_{total}"
        if phone and phone not in ("", "nan") and raw_date:
            try:
                dt = datetime.strptime(str(raw_date).strip(), DATE_FORMAT_IN_CSV)
                ts = int(dt.timestamp() * 1000)
                clean_phone = "".join(c for c in phone if c.isdigit())[-10:]
                if clean_phone:
                    call_id = f"{clean_phone}_{ts}"
            except:
                pass

        record = {k: None if pd.isna(v) else str(v).strip() if isinstance(v, str) else v 
                 for k, v in row.items()}

        # Fix column names for frontend
        if "call_reason" in record:
            record["Call Reason"] = record.pop("call_reason")
        if "client_type" in record:
            record["Client type"] = record.pop("client_type")

        # Format date
        if "call_date" in record and record["call_date"]:
            try:
                record["call_date"] = pd.to_datetime(record["call_date"]).strftime(FINAL_DATE_FORMAT)
            except:
                record["call_date"] = None

        # Avoid duplicate IDs
        base = call_id
        i = 1
        while call_id in final_calls["calls"][date_key]:
            call_id = f"{base}_{i}"
            i += 1

        final_calls["calls"][date_key][call_id] = record

# Save
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(final_calls, f, indent=2, ensure_ascii=False)

print(f"\nSUCCESS! Processed {total} records → {OUTPUT_JSON}")