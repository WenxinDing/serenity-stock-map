"""Build complete Chinese translations for the public post archive.

This runs only in the data build. The browser never sends post text to a
translation service: it reads the generated translations.json file instead.
"""

import argparse
import json
import os
import urllib.error
import urllib.request

ARCHIVE_PATH = "archive.json"
TRANSLATIONS_PATH = "translations.json"
DEFAULT_DAILY_LIMIT = 20
MAX_BATCH_CHARS = 10_000


def load_json(path, fallback):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def batches(posts):
    batch = []
    size = 0
    for post in posts:
        text = post.get("text", "")
        item_size = len(text) + 100
        if batch and size + item_size > MAX_BATCH_CHARS:
            yield batch
            batch, size = [], 0
        batch.append({"id": str(post["id"]), "text": text})
        size += item_size
    if batch:
        yield batch


def translate_batch(api_token, account_id, batch):
    request_body = {
        "text": [item["text"] for item in batch],
        "source_lang": "en",
        "target_lang": "zh",
    }
    request = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/m2m100-1.2b",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)
    translated = payload.get("result", {}).get("translated_text")
    if isinstance(translated, str) and len(batch) == 1:
        translated = [translated]
    if not isinstance(translated, list) or len(translated) != len(batch):
        raise ValueError("Cloudflare translation response did not match the requested posts")
    return [
        {"id": item["id"], "translation": text.strip()}
        for item, text in zip(batch, translated)
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true", help="Translate every missing archive post.")
    parser.add_argument("--limit", type=int, help="Maximum number of missing posts to translate.")
    args = parser.parse_args()

    api_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    if not api_token or not account_id:
        raise RuntimeError("Cloudflare Workers AI credentials are not configured")

    archive = load_json(ARCHIVE_PATH, [])
    translations = load_json(TRANSLATIONS_PATH, {})
    missing = [post for post in archive if str(post.get("id")) not in translations and post.get("text")]
    if not args.backfill:
        missing = missing[: args.limit or DEFAULT_DAILY_LIMIT]
    elif args.limit:
        missing = missing[: args.limit]

    if not missing:
        print("translations", len(translations), "attempted", 0)
        return

    updated = 0
    for index, batch in enumerate(batches(missing), 1):
        expected = {item["id"] for item in batch}
        items = translate_batch(api_token, account_id, batch)
        received = {str(item.get("id")): item.get("translation", "").strip() for item in items}
        if set(received) != expected or not all(received.values()):
            raise ValueError("translation response did not match the requested posts")
        translations.update(received)
        updated += len(batch)
        with open(TRANSLATIONS_PATH, "w", encoding="utf-8") as handle:
            json.dump(translations, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print(f"batch {index}: translated {updated}/{len(missing)}")

    print("translations", len(translations), "updated", updated)


if __name__ == "__main__":
    main()
