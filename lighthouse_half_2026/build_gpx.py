"""Build a GPX for the Lighthouse Half Marathon course.

Course description (from race website + USATF certification + on-course timing splits):
- Start/finish at Shoreline Aquatic Park lighthouse area
- Out-and-back along the Long Beach Shoreline Pedestrian/Bike Path
- Two laps (Lap 1 / Lap 2 segments confirmed in timing splits)
- Mostly flat, USATF certified ~21.1 km

We pull the Shoreline Bike/Pedestrian Path geometry from OpenStreetMap via Overpass
and build a two-lap out-and-back GPX from the start point.
"""
import json, urllib.request, urllib.parse, math
from pathlib import Path

HERE = Path(__file__).parent

# Bounding box: covers Shoreline Aquatic Park east through Belmont Shore.
QUERY = """
[out:json][timeout:30];
(
  way["highway"~"cycleway|path"]["bicycle"!="no"](33.7480,-118.2050,33.7700,-118.1200);
);
out body;
>;
out skel qt;
"""

def fetch_overpass():
    cache = HERE / "overpass_cache.json"
    if cache.exists():
        return json.loads(cache.read_text())
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": "lighthouse-half-2026-mapper/1.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode()
    cache.write_text(body)
    return json.loads(body)

def hav(a, b):
    R = 6371000.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1; dlon = lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))

osm = fetch_overpass()
nodes = {n["id"]: (n["lat"], n["lon"]) for n in osm["elements"] if n["type"] == "node"}
ways = [w for w in osm["elements"] if w["type"] == "way"]

# Build adjacency from way segments (keep only ways that touch the waterfront strip
# south of Ocean Blvd / Shoreline Dr — lat < 33.764).
adj = {}
def add(a, b, name):
    adj.setdefault(a, []).append((b, name))
    adj.setdefault(b, []).append((a, name))

for w in ways:
    nds = w["nodes"]
    nm = w.get("tags", {}).get("name", "")
    for i in range(len(nds) - 1):
        a, b = nds[i], nds[i+1]
        if a not in nodes or b not in nodes: continue
        la, lo = nodes[a]; lb, lop = nodes[b]
        # Keep waterfront-ish nodes only
        if la > 33.7660 or lb > 33.7660: continue
        if la < 33.7480 or lb < 33.7480: continue
        if lo < -118.2050 or lop < -118.2050: continue
        if lo > -118.1200 or lop > -118.1200: continue
        add(a, b, nm)

print(f"path nodes: {len(adj)}  ways considered: {len(ways)}")

# Find start node nearest the Lighthouse (Lions Lighthouse for Sight),
# Shoreline Aquatic Park, approx 33.7593, -118.1903
START_LL = (33.7593, -118.1903)
start_id = min(adj.keys(), key=lambda nid: hav(nodes[nid], START_LL))
print(f"start: {nodes[start_id]} (target {START_LL})")

# Greedy walk eastward along the most "easterly-trending" path,
# preferring the next neighbor whose longitude is larger (more east) and
# whose latitude stays close to the path's typical range.
visited_edges = set()
def walk(start, target_distance_m):
    """Walk along the path graph trying to head east, stopping near target_distance."""
    path = [start]
    total = 0.0
    cur = start
    while total < target_distance_m:
        opts = []
        for nxt, _ in adj.get(cur, []):
            edge = tuple(sorted((cur, nxt)))
            if edge in visited_edges: continue
            opts.append(nxt)
        if not opts: break
        cur_ll = nodes[cur]
        # Heuristic: pick neighbor maximizing eastward progress, lightly penalizing
        # large north/south deviations.
        def score(n):
            ll = nodes[n]
            east = ll[1] - cur_ll[1]            # positive => east
            ns_pen = abs(ll[0] - cur_ll[0]) * 2 # discourage zig-zag north/south
            return east - ns_pen
        nxt = max(opts, key=score)
        edge = tuple(sorted((cur, nxt)))
        visited_edges.add(edge)
        d = hav(nodes[cur], nodes[nxt])
        total += d
        path.append(nxt)
        cur = nxt
    return path, total

OUT_TARGET = 5275  # meters (one-way ~3.28 mi -> 13.1 mi total over 2 out-and-back loops)
out_path, out_dist = walk(start_id, OUT_TARGET)
print(f"out-leg: {len(out_path)} nodes, {out_dist:.0f} m ({out_dist/1609.344:.2f} mi)")

# Build full route: lap = out + back; do 2 laps
def to_coords(node_ids):
    return [nodes[i] for i in node_ids]

out_coords = to_coords(out_path)
back_coords = list(reversed(out_coords))
full = out_coords + back_coords + out_coords + back_coords

# Total distance
total_m = 0.0
for i in range(len(full)-1):
    total_m += hav(full[i], full[i+1])
print(f"total course: {total_m:.0f} m  ({total_m/1609.344:.3f} mi)")

# Densify and trim to exactly 21097.5 m (13.1094 mi)
TARGET_M = 21097.5
def cumulative(coords):
    out = [0.0]
    for i in range(1, len(coords)):
        out.append(out[-1] + hav(coords[i-1], coords[i]))
    return out

# Trim by walking the cumulative until target
cum = cumulative(full)
if cum[-1] > TARGET_M:
    # find segment containing TARGET_M
    for i in range(1, len(cum)):
        if cum[i] >= TARGET_M:
            frac = (TARGET_M - cum[i-1]) / (cum[i] - cum[i-1])
            a, b = full[i-1], full[i]
            lat = a[0] + (b[0] - a[0]) * frac
            lon = a[1] + (b[1] - a[1]) * frac
            full = full[:i] + [(lat, lon)]
            break
else:
    # extend last leg slightly back toward start
    pass

total_final = sum(hav(full[i], full[i+1]) for i in range(len(full)-1))
print(f"final length: {total_final:.0f} m ({total_final/1609.344:.3f} mi)  points: {len(full)}")

# Emit GPX
out = HERE / "lighthouse_half_2026_course.gpx"
with out.open("w", encoding="utf-8") as f:
    f.write("""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="lighthouse-half-2026-mapper"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>2026 Lighthouse Half Marathon (Long Beach, CA) — Course</name>
    <desc>Approximate two-lap out-and-back along the Long Beach Shoreline Pedestrian/Bike Path. Start/finish at Shoreline Aquatic Park (Lions Lighthouse). Reconstructed from OpenStreetMap; not the official USATF map.</desc>
    <time>2026-05-24T14:00:00Z</time>
  </metadata>
  <trk>
    <name>Lighthouse Half — 2 laps</name>
    <trkseg>
""")
    for lat, lon in full:
        f.write(f'      <trkpt lat="{lat:.6f}" lon="{lon:.6f}"></trkpt>\n')
    f.write("""    </trkseg>
  </trk>
</gpx>
""")
print("wrote", out)
