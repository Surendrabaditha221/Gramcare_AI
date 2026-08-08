import urllib.request
import json
import time

url = 'http://127.0.0.1:8001/api/chat/stream'
payload = {
    'message': 'I have had fever and cough for 2 days',
    'patient_name': 'Primary User',
    'language': 'en'
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

print(f"Connecting to {url}...")
start = time.time()
res = urllib.request.urlopen(req)
print(f"HTTP Status: {res.status}")

chunk_idx = 0
total_bytes = 0

while True:
    chunk = res.read(128)
    if not chunk:
        break
    chunk_idx += 1
    total_bytes += len(chunk)
    elapsed = time.time() - start
    print(f"Chunk #{chunk_idx} | {len(chunk)} bytes | Elapsed: {elapsed:.3f}s | Content: {repr(chunk.decode('utf-8', errors='ignore'))}")

print(f"\nStream Finished: {chunk_idx} chunks, {total_bytes} bytes in {time.time()-start:.3f}s")
