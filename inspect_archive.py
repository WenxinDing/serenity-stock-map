import json, re, collections
x = json.load(open('archive.json', encoding='utf-8'))
c = collections.Counter()
for t in x:
    c.update(re.findall(r'\$([A-Z]{2,5})\b', t.get('text', '')))
print(len(x))
print(c.most_common(50))
