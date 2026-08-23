"""Build complete Chinese translations for the public post archive.

This runs only in the data build. The browser never sends post text to a
translation service: it reads the generated translations.json file instead.
"""

import argparse
import json
import os
import time
import urllib.error
import urllib.request

ARCHIVE_PATH = "archive.json"
TRANSLATIONS_PATH = "translations.json"
MODEL = os.getenv("TRANSLATION_MODEL", "gpt-5-mini")
DEFAULT_DAILY_LIMIT = 20
MAX_BATCH_CHARS = 10_000

INSTRUCTIONS = """You are a meticulous financial translator. Translate every
post into complete, natural Simplified Chinese. Do not summarize, omit,
reinterpret, soften, or add investment advice. Preserve paragraph breaks,
bullets, numbers, URLs, @handles, and cashtags exactly. Keep stock tickers such
as $AAOI unchanged. Use correct investment terminology: ATM means \"按市价增发\";
ASP means \"平均售价\"; TAM means \"总可服务市场\"; LTA means \"长期供货协议\";
CPO means \"共封装光学（CPO）\"; CW means \"连续波（CW）\". Preserve other technical
acronyms such as EML, DFB, TIA, DSP, NPO, and 1.6T when appropriate. Return
only a JSON object matching the requested schema. Each input id must appear
exactly once, and translation text must contain the full translation."""


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


def schema_for(expected_count):
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "translations": {
                "type": "array",
                "minItems": expected_count,
                "maxItems": expected_count,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "string"},
                        "translation": {"type": "string"},
                    },
                    "required": ["id", "translation"],
                },
            }
        },
        "required": ["translations"],
    }


def response_text(payload):
    for output in payload.get("output", []):
        for content in output.get("content", []):
            if content.get("type") == "output_text":
                return content.get("text", "")
    return payload.get("output_text", "")


def translate_batch(api_key, batch):
    request_body = {
        "model": MODEL,
        "store": False,
        "reasoning": {"effort": "low"},
        "instructions": INSTRUCTIONS,
        "input": json.dumps({"posts": batch}, ensure_ascii=False),
        "max_output_tokens": 16_000,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "post_translations",
                "strict": True,
                "schema": schema_for(len(batch)),
            }
        },
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)
    return json.loads(response_text(payload))["translations"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true", help="Translate every missing archive post.")
    parser.add_argument("--limit", type=int, help="Maximum number of missing posts to translate.")
    args = parser.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is not configured; translation build skipped.")
        return

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
        try:
            items = translate_batch(api_key, batch)
            received = {str(item.get("id")): item.get("translation", "").strip() for item in items}
            if set(received) != expected or not all(received.values()):
                raise ValueError("translation response did not match the requested posts")
            translations.update(received)
            updated += len(batch)
            with open(TRANSLATIONS_PATH, "w", encoding="utf-8") as handle:
                json.dump(translations, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            print(f"batch {index}: translated {updated}/{len(missing)}")
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, json.JSONDecodeError) as error:
            print(f"batch {index}: skipped ({error})")
            time.sleep(2)

    print("translations", len(translations), "updated", updated)


if __name__ == "__main__":
    main()
