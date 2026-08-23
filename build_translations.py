import json, re, time, urllib.parse, urllib.request
from datetime import datetime, timezone

archive=json.load(open('archive.json',encoding='utf-8'))
path='translations.json'
try: translations=json.load(open(path,encoding='utf-8'))
except Exception: translations={}

def chunks(text, limit=340):
    parts=[]; buf=''
    for sentence in re.findall(r'[^.!?\n]+[.!?]?', text):
        sentence=sentence.strip()
        if not sentence: continue
        if buf and len(buf)+len(sentence)+1>limit: parts.append(buf); buf=''
        if len(sentence)>limit:
            if buf: parts.append(buf); buf=''
            parts.extend(sentence[i:i+limit] for i in range(0,len(sentence),limit))
        else: buf=(buf+' '+sentence).strip()
    if buf: parts.append(buf)
    return parts

def translate(text):
    out=[]
    for part in chunks(text):
        url='https://api.mymemory.translated.net/get?q='+urllib.parse.quote(part,safe='')+'&langpair=en|zh-CN'
        try:
            with urllib.request.urlopen(url, timeout=20) as r: obj=json.load(r)
            value=obj.get('responseData',{}).get('translatedText','')
            if value and 'MYMEMORY WARNING' not in value.upper() and 'QUERY LENGTH LIMIT' not in value.upper(): out.append(value)
            else: return None
            time.sleep(.15)
        except Exception: return None
    return ''.join(out) if out else None

# Keep scheduled runs bounded. Existing translations are never overwritten;
# newest untranslated posts are prioritized for the next deploy.
# This is the boundary between the historical archive (which is manually
# reviewed) and future daily additions. The provider is never used to rewrite
# or fill the existing historical archive.
HISTORICAL_CUTOFF = datetime(2026, 8, 21, 20, 47, 27, tzinfo=timezone.utc)
MAX_PER_RUN = 20

def created_at(tweet):
    value=tweet.get('createdAtISO','').replace('/', '-').replace('Z', '+00:00')
    try:
        parsed=datetime.fromisoformat(value)
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)

todo=[t for t in sorted(archive, key=created_at, reverse=True)
      if created_at(t) > HISTORICAL_CUTOFF and str(t.get('id')) not in translations][:MAX_PER_RUN]
for i,t in enumerate(todo, 1):
    value=translate(t.get('text',''))
    if value: translations[str(t['id'])]=value
    print('translated',i,'/',len(todo))
json.dump(translations,open(path,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('translations',len(translations),'attempted',len(todo))
