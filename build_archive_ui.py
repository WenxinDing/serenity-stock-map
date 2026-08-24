"""Create the small browser payload from the full public archive."""

import json


with open("archive.json", encoding="utf-8-sig") as source:
    archive = json.load(source)

compact = [
    {"id": str(post["id"]), "text": post.get("text", ""), "createdAtISO": post["createdAtISO"]}
    for post in archive
    if post.get("text") and post.get("createdAtISO")
]

with open("archive-ui.json", "w", encoding="utf-8") as output:
    json.dump(compact, output, ensure_ascii=False, separators=(",", ":"))
    output.write("\n")

print(f"archive-ui {len(compact)} posts")
