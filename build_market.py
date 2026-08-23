import json, datetime, urllib.request, concurrent.futures, re, os
archive = json.load(open('archive.json', encoding='utf-8'))
symbols = sorted({s for t in archive for s in re.findall(r'\$([A-Z]{2,5})\b', t.get('text',''))})
start = int(datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc).timestamp())
end = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
def fetch(symbol):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={start}&period2={end}&interval=1d&events=history'
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
        obj = json.load(urllib.request.urlopen(req, timeout=20))['chart']['result'][0]
        rows = [[datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime('%Y-%m-%d'), round(v, 2)] for ts,v in zip(obj['timestamp'], obj['indicators']['quote'][0]['close']) if v is not None]
        return symbol, rows
    except Exception:
        return symbol, []
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    results = dict(pool.map(fetch, symbols))
market = {k:v for k,v in results.items() if v}
json.dump(market, open('market-data.json','w',encoding='utf-8'), separators=(',',':'))
json.dump({'mentioned': symbols, 'with_market_data': sorted(market), 'without_market_data': sorted(set(symbols)-set(market))}, open('coverage.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
print('mentioned', len(symbols), 'market_data', len(market), 'without_market_data', len(symbols)-len(market), 'bytes', os.path.getsize('market-data.json'))
