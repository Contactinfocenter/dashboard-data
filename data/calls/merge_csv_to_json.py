import pandas as pd
import json
import os
from datetime import datetime

# --- FOLDER CONFIGURATION ---
CSV_FOLDER = "dashboard-data/data/calls/CSV"
OUTPUT_JSON = "dashboard-data/data/calls/all_calls.json"

DATE_FORMAT_IN_CSV = "%m/%d/%Y %H:%M"

# Final structure
final_calls = {"calls": {}}

print(f"Scanning folder: {CSV_FOLDER}")

# --- Get all CSV filenames automatically ---
csv_files = [f for f in os.listdir(CSV_FOLDER) if f.lower().endswith(".csv")]
csv_files.sort()

print("CSV Files found:", csv_files)

# --- Process CSV files ---
for filename in csv_files:

    file_path = os.path.join(CSV_FOLDER, filename)

    print(f"\nProcessing {filename}...")

    try:
        df = pd.read_csv(file_path, encoding="cp1252")
        df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    except Exception as e:
        print(f"ERROR reading {filename}: {e}")
        continue

    date_key = filename.replace(".csv", "")

    if date_key not in final_calls["calls"]:
        final_calls["calls"][date_key] = {}

    for index, row in df.iterrows():

        phone = row.get("phone_number")
        raw_dt = row.get("call_date")

        # Default fallback ID
        call_id = f"{date_key}_{index}"

        # Try generating unique ID
        if raw_dt and phone:
            try:
                dt = datetime.strptime(str(raw_dt).strip(), DATE_FORMAT_IN_CSV)
                timestamp_ms = int(dt.timestamp() * 1000)
                call_id = f"{int(float(phone))}_{timestamp_ms}"
            except:
                pass  # fallback stays

        # Convert row values
        call_data = {k: (None if pd.isna(v) else v) for k, v in row.to_dict().items()}

        # Final mapping to required JSON format
        formatted = {}
        for k, v in call_data.items():
            if k == "call_reason":
                formatted["Call Reason"] = v
            elif k == "client_type":
                formatted["Client type"] = v
            else:
                formatted[k] = v

        # Standardize call_date formatting
        if "call_date" in formatted and isinstance(formatted["call_date"], str):
            try:
                dt = datetime.strptime(formatted["call_date"].strip(), DATE_FORMAT_IN_CSV)
                formatted["call_date"] = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                pass

        final_calls["calls"][date_key][call_id] = formatted

# Total count
total_records = sum(len(final_calls["calls"][d]) for d in final_calls["calls"])
print(f"\nTotal records merged: {total_records}")

# Save JSON
if total_records > 0:
    with open(OUTPUT_JSON, "w") as f:
        json.dump(final_calls, f, indent=2)
    print(f"Saved: {OUTPUT_JSON}")
else:
    print("No records found! JSON not created.")
