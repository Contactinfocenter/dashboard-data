#!/usr/bin/env python3
import pandas as pd
import json
import os
from datetime import datetime

# AUTO-FIND THE CSV FOLDER – works from anywhere in the repo
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))           # folder where this .py file lives
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))           # go up two levels → repo root
CSV_FOLDER = os.path.join(REPO_ROOT, "dashboard-data", "data", "calls", "CSV")
OUTPUT_JSON = os.path.join(REPO_ROOT, "dashboard-data", "data", "calls", "all_calls.json")

DATE_FORMAT_IN_CSV = "%m/%d/%Y %H:%M"
FINAL_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Create folder if missing
os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

print("CSV folder  :", CSV_FOLDER)
print("Output file :", OUTPUT_JSON)

if not os.path.exists(CSV_FOLDER):
    print("ERROR: CSV folder not found!")
    exit(1)

final_calls = {"calls": {}}
total_records = 0

csv_files = sorted([f for f in os.listdir(CSV_FOLDER) if f.lower().endswith(".csv")])
print(f"Found {len(csv_files)} CSV files\n")

for filename in csv_files:
    file_path = os.path.join(CSV_FOLDER, filename)
    date_key = os.path.splitext(filename)[0]

    print(f"Processing → {filename}")

    df = None
    for encoding in ['cp1252', 'utf-8-sig', 'latin1']:
        try:
            df = pd.read_csv(file_path, encoding=encoding)
            break
        except:
            continue
    if df is None:
        print("  Could not read file")
        continue

    df.columns = df.columns.str.strip().str.lower().str.replace(r"\s+", "_", regex=True)

    if date_key not in final_calls["calls"]:
        final_calls["calls"][date_key] = {}

    for _, row in df.iterrows():
        phone = str(row.get("phone_number", "")).strip()
        raw_date = row.get("call_date")

        # Default ID
        call_id = f"{date_key}_{total_records}"

        if phone and phone not in ("", "nan") and raw_date:
            try:
                dt = datetime.strptime(str(raw_date).strip(), DATE_FORMAT_IN_CSV)
                ts = int(dt.timestamp() * 1000)
                clean_phone = ''.join(filter(str.isdigit, phone))[-10:]
                if clean_phone:
                    call_id = f"{clean_phone}_{ts}"
            except:
                pass

        record = {k: None if pd.isna(v) else str(v).strip() if isinstance(v, str) else v for k, v in row.items()}

        # Nice field names
        if "call_reason" in record:
            record["Call Reason"] = record.pop("call_reason")
        if "client_type" in record:
            record["Client type"] = record.pop("client_type")

        # Format date
        if "call_date" in record and record["call_date"]:
            try:
                if isinstance(record["call_date"], str):
                    dt = datetime.strptime(record["call_date"], DATE_FORMAT_IN_CSV)
                else:
                    dt = pd.to_datetime(record["call_date"])
                record["call_date"] = dt.strftime(FINAL_DATE_FORMAT)
            except:
                record["call_date"] = None

        # Prevent duplicate keys
        base = call_id
        i = 1
        while call_id in final_calls["calls"][date_key]:
            call_id = f"{base}_{i}"
            i += 1

        final_calls["calls"][date_key][call_id] = record
        total_records += 1

# Save
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(final_calls, f, indent=2, ensure_ascii=False, default=str)

print(f"\nSUCCESS! {total_records} calls → all_calls.json")