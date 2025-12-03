#!/usr/bin/env python3
import pandas as pd
import json
import os
from datetime import datetime

# 4 MAGIC LINES – works forever, no matter what
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPT_DIR)))
CSV_FOLDER = os.path.join(REPO_ROOT, "dashboard-data", "data", "calls", "CSV")
OUTPUT_JSON = os.path.join(REPO_ROOT, "dashboard-data", "data", "calls", "all_calls.json")

DATE_FORMAT_IN_CSV = "%m/%d/%Y %H:%M"
FINAL_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

# Create folder if needed

final_calls = {"calls": {}}
total = 0

for filename in sorted(f for f in os.listdir(CSV_FOLDER) if f.lower().endswith(".csv")):
    date_key = os.path.splitext(filename)[0]
    print(f"Processing {filename}")

    df = None
    for enc in ["cp1252", "utf-8-sig", "latin1"]:
        try:
            df = pd.read_csv(os.path.join(CSV_FOLDER, filename), encoding=enc)
            break
        except:
            continue
    if df is None:
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

        record = {k: None if pd.isna(v) else str(v).strip() if isinstance(v, str) else v for k, v in row.items()}

        if "call_reason" in record:
            record["Call Reason"] = record.pop("call_reason")
        if "client_type" in record:
            record["Client type"] = record.pop("client_type")

        if "call_date" in record and record["call_date"]:
            try:
                record["call_date"] = pd.to_datetime(record["call_date"]).strftime(FINAL_DATE_FORMAT)
            except:
                record["call_date"] = None

        # avoid duplicates
        base = call_id
        i = 1
        while call_id in final_calls["calls"][date_key]:
            call_id = f"{base}_{i}"
            i += 1

        final_calls["calls"][date_key][call_id] = record

# Save
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(final_calls, f, indent=2, ensure_ascii=False)

print(f"\nSUCCESS! {total} records → all_calls.json generated")