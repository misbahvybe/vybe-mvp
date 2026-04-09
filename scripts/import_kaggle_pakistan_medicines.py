#!/usr/bin/env python3
"""
Download the Kaggle dataset `muhammadabdullah222/pakistan-medicines-dataset` and
create products on every Vybe store that has the **Medicine** platform category.

Run locally (not on Railway) — needs Python + Kaggle credentials.

Setup
-----
1. pip install -r scripts/requirements-kaggle-import.txt
2. Kaggle API: place ~/.kaggle/kaggle.json OR set KAGGLE_USERNAME + KAGGLE_KEY
   (see https://www.kaggle.com/docs/api)
3. Env file `.env` in repo root or export:
     VYBE_API_BASE_URL=https://YOUR-API.up.railway.app/api/v1
     VYBE_ADMIN_TOKEN=<JWT for ADMIN user>

Usage
-----
  python scripts/import_kaggle_pakistan_medicines.py --dry-run
  python scripts/import_kaggle_pakistan_medicines.py --limit 500
  python scripts/import_kaggle_pakistan_medicines.py --publish --default-price 50

By default only stores that have **Medicine** and **not** Food/Grocery get imports. If every pharmacy also has Food, use e.g. --store-name-contains Pharmacy to target it, or --allow-mixed-platform-stores for all Medicine-tagged stores.

Default mode imports as **draft** (hidden from customers) so you can set prices in admin.
Use --publish to create live products (still verify prices for your pharmacy).

Images: if the CSV has a column with an http(s) image URL, it is passed to imageUrl.
Local image paths in the CSV cannot be uploaded automatically (use manual upload or Cloudinary).

License: comply with the dataset license on Kaggle and your pharmacy regulations.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass


def norm_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def pick_name_column(df: pd.DataFrame) -> str | None:
    candidates = [
        "medicine_name",
        "product_name",
        "name",
        "drug_name",
        "generic_name",
        "item_name",
        "description",
    ]
    cols = {norm_key(c): c for c in df.columns}
    for want in candidates:
        if want in cols.values():
            return want
        nk = norm_key(want)
        if nk in cols:
            return cols[nk]
    # first text column that looks like a name
    for c in df.columns:
        if df[c].dtype == object and df[c].notna().sum() > 0:
            return c
    return None


def pick_price_column(df: pd.DataFrame) -> str | None:
    keys = [norm_key(c) for c in df.columns]
    for i, c in enumerate(df.columns):
        k = keys[i]
        if any(x in k for x in ("price", "mrp", "retail", "unitprice", "cost")):
            return c
    return None


def pick_image_column(df: pd.DataFrame) -> str | None:
    for c in df.columns:
        k = norm_key(c)
        if any(x in k for x in ("image", "photo", "picture", "url", "link")):
            return c
    return None


def pick_desc_column(df: pd.DataFrame, name_col: str) -> str | None:
    for c in df.columns:
        if c == name_col:
            continue
        k = norm_key(c)
        if "desc" in k or "detail" in k or "note" in k:
            return c
    return None


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower())


def store_is_medicine_only(store: dict[str, Any]) -> bool:
    """
    True if the store is on the Medicine tab but not Food or Grocery.
    Avoids importing drugs into burger/restaurant stores that also ticked Medicine.
    """
    cats = [str(c).strip().lower() for c in (store.get("platformCategories") or [])]
    if "medicine" not in cats:
        return False
    if "food" in cats or "grocery" in cats:
        return False
    return True


def build_product_body(
    item: dict[str, Any],
    *,
    publish: bool,
    legacy_no_isdraft: bool,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": item["name"],
        "price": item["price"],
        "description": item.get("description"),
    }
    if item.get("imageUrl"):
        body["imageUrl"] = item["imageUrl"]
    if publish:
        body["stock"] = 999
        body["isAvailable"] = True
    elif legacy_no_isdraft:
        body["stock"] = 0
        body["isAvailable"] = False
    else:
        body["isDraft"] = True
    return body


def parse_price(val: Any) -> float | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def is_http_url(s: str) -> bool:
    s = s.strip()
    return s.startswith("http://") or s.startswith("https://")


def load_csvs(dataset_dir: Path) -> pd.DataFrame:
    csvs = list(dataset_dir.rglob("*.csv"))
    if not csvs:
        raise FileNotFoundError(f"No CSV files under {dataset_dir}")
    frames = []
    for p in csvs:
        try:
            frames.append(pd.read_csv(p, encoding="utf-8", on_bad_lines="skip"))
        except Exception:
            frames.append(pd.read_csv(p, encoding="latin-1", on_bad_lines="skip"))
    return pd.concat(frames, ignore_index=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Kaggle Pakistan medicines into Vybe medicine stores")
    parser.add_argument("--dry-run", action="store_true", help="Parse only; no API calls")
    parser.add_argument("--limit", type=int, default=0, help="Max rows per store (0 = all)")
    parser.add_argument("--default-price", type=float, default=1.0, help="PKR when price missing (draft or publish)")
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Create live products (isDraft=false). Otherwise drafts (recommended).",
    )
    parser.add_argument(
        "--include-unapproved-stores",
        action="store_true",
        help="Also import into stores not yet approved (admin only).",
    )
    parser.add_argument(
        "--allow-mixed-platform-stores",
        action="store_true",
        help="Import into every store tagged Medicine, even if it also has Food/Grocery.",
    )
    parser.add_argument(
        "--store-name-contains",
        metavar="TEXT",
        default="",
        help="Only stores whose name contains TEXT (case-insensitive). Use e.g. Pharmacy to target one store without importing into restaurants.",
    )
    parser.add_argument(
        "--store-ids",
        metavar="IDS",
        default="",
        help="Comma-separated store UUIDs to import into (must still be in Medicine platform list unless you use --allow-mixed-platform-stores with care).",
    )
    parser.add_argument("--sleep", type=float, default=0.05, help="Seconds between POSTs")
    args = parser.parse_args()

    base = os.environ.get("VYBE_API_BASE_URL", "").rstrip("/")
    token = os.environ.get("VYBE_ADMIN_TOKEN", "").strip()
    if not args.dry_run and (not base or not token):
        print("Set VYBE_API_BASE_URL and VYBE_ADMIN_TOKEN", file=sys.stderr)
        return 1

    print("Downloading dataset via kagglehub…")
    import kagglehub

    path = kagglehub.dataset_download("muhammadabdullah222/pakistan-medicines-dataset")
    root = Path(path)
    print("Dataset path:", root)

    df = load_csvs(root)
    print(f"Loaded {len(df)} rows, columns: {list(df.columns)}")

    name_col = pick_name_column(df)
    if not name_col:
        print("Could not detect a name column.", file=sys.stderr)
        return 1
    price_col = pick_price_column(df)
    img_col = pick_image_column(df)
    desc_col = pick_desc_column(df, name_col)
    print(f"Using name={name_col!r}, price={price_col!r}, image={img_col!r}, description={desc_col!r}")

    if args.limit and args.limit > 0:
        df = df.head(args.limit)

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for _, r in df.iterrows():
        raw_name = r.get(name_col)
        if raw_name is None or (isinstance(raw_name, float) and pd.isna(raw_name)):
            continue
        name = str(raw_name).strip()
        if len(name) < 2:
            continue
        nk = normalize_name(name)
        if nk in seen:
            continue
        seen.add(nk)
        price = parse_price(r.get(price_col)) if price_col else None
        if price is None or price <= 0:
            price = args.default_price
        desc = None
        if desc_col:
            d = r.get(desc_col)
            if d is not None and not (isinstance(d, float) and pd.isna(d)):
                desc = str(d).strip()[:2000] or None
        image_url = None
        if img_col:
            v = r.get(img_col)
            if v is not None and not (isinstance(v, float) and pd.isna(v)):
                s = str(v).strip()
                if is_http_url(s):
                    image_url = s
        rows.append({"name": name, "price": float(price), "description": desc, "imageUrl": image_url})

    print(f"Deduplicated to {len(rows)} products")

    if args.dry_run:
        for x in rows[:5]:
            print("  sample:", x)
        return 0

    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(base_url=base, headers=headers, timeout=60.0) as client:
        qs = {"platform": "medicine"}
        if args.include_unapproved_stores:
            qs["includeUnapproved"] = "true"
        r = client.get("/admin/stores", params=qs)
        r.raise_for_status()
        stores = r.json()
        if not stores:
            print("No stores with Medicine platform category. Tag stores in Admin → Store menu → Platform categories.")
            return 1

        targeted = bool((args.store_ids or "").strip() or (args.store_name_contains or "").strip())

        if (args.store_ids or "").strip():
            want = {x.strip() for x in args.store_ids.split(",") if x.strip()}
            stores = [s for s in stores if s.get("id") in want]
            if not stores:
                print("No stores matched --store-ids.", file=sys.stderr)
                return 1

        if (args.store_name_contains or "").strip():
            sub = args.store_name_contains.strip().lower()
            stores = [s for s in stores if sub in str(s.get("name", "")).lower()]
            if not stores:
                print(f"No stores matched --store-name-contains {args.store_name_contains!r}.", file=sys.stderr)
                return 1

        use_medicine_only = not args.allow_mixed_platform_stores and not targeted
        if use_medicine_only:
            before = len(stores)
            stores = [s for s in stores if store_is_medicine_only(s)]
            skipped = before - len(stores)
            if skipped:
                print(
                    f"Skipped {skipped} store(s) that also have Food/Grocery "
                    f"(use --store-name-contains Pharmacy, --store-ids …, or --allow-mixed-platform-stores)."
                )
        if not stores:
            print(
                "No stores to import into. Options: (1) In Admin, remove Food/Grocery from your pharmacy so it is medicine-only; "
                "(2) python scripts/import_kaggle_pakistan_medicines.py --store-name-contains Pharmacy …; "
                "(3) --allow-mixed-platform-stores (imports into all Medicine-tagged stores, including restaurants).",
                file=sys.stderr,
            )
            return 1

        label = "medicine-only" if use_medicine_only else "selected"
        print(f"Importing into {len(stores)} {label} store(s):", [s["name"] for s in stores])

        legacy_no_isdraft: list[bool] = [False]

        for store in stores:
            sid = store["id"]
            pr = client.get(f"/admin/stores/{sid}/products")
            pr.raise_for_status()
            existing = {normalize_name(p["name"]) for p in pr.json()}
            created = 0
            skipped = 0
            for item in rows:
                if normalize_name(item["name"]) in existing:
                    skipped += 1
                    continue
                body = build_product_body(item, publish=args.publish, legacy_no_isdraft=legacy_no_isdraft[0])
                url = f"/admin/stores/{sid}/products"
                resp = client.post(url, json=body)
                if resp.status_code == 400 and "isDraft" in resp.text and not args.publish:
                    if not legacy_no_isdraft[0]:
                        print(
                            "  Note: API has no isDraft field; using stock=0 and isAvailable=false instead. "
                            "Redeploy latest backend for full draft approval flow.",
                            file=sys.stderr,
                        )
                        legacy_no_isdraft[0] = True
                    body = build_product_body(item, publish=args.publish, legacy_no_isdraft=True)
                    resp = client.post(url, json=body)
                if resp.status_code >= 400:
                    print(f"  ERROR {sid} {item['name'][:40]}: {resp.status_code} {resp.text[:200]}")
                    continue
                existing.add(normalize_name(item["name"]))
                created += 1
                time.sleep(args.sleep)
            print(f"Store {store['name']!r}: created {created}, skipped duplicates {skipped}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
