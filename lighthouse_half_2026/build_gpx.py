"""Build an approximate GPX for the 2026 Lighthouse Half Marathon course.

Course (per race website + USATF certification + timing splits showing Lap 1 / Lap 2):
- Start/finish: Shoreline Aquatic Park (Lions Lighthouse) — ~33.7593, -118.1903
- Two out-and-back loops along the Long Beach Shoreline Pedestrian/Bike Path
- Mostly flat, USATF-certified 13.1094 mi (21097.5 m)

We ask OSRM (public foot-routing API on OSM data) for an east-bound route along
the waterfront, trim it to exactly 1/4 of a half-marathon, then mirror+repeat for
two full out-and-back laps.
"""
import json, math, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
START = (33.7593, -118.1903)        # Lions Lighthouse, Shoreline Aquatic Park
EAST  = (33.7575, -118.1325)        # generous eastern target (will be trimmed)
TARGET_HALF_MI = 13.1094
TARGET_M = TARGET_HALF_MI * 1609.344
LEG_M = TARGET_M / 4                # one-way leg = quarter of full course

def hav(a, b):
    R = 6371000.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1; dlon = lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))

# 1) Get walking route along the waterfront
def osrm_route(a, b):
    url = (f"https://router.project-osrm.org/route/v1/foot/"
           f"{a[1]},{a[0]};{b[1]},{b[0]}"
           f"?overview=full&geometries=geojson&alternatives=false")
    req = urllib.request.Request(url, headers={"User-Agent": "lighthouse-mapper/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

cache = HERE / "osrm_cache.json"
if cache.exists():
    rt = json.loads(cache.read_text())
else:
    rt = osrm_route(START, EAST)
    cache.write_text(json.dumps(rt))

assert rt.get("code") == "Ok", rt
geom = rt["routes"][0]["geometry"]["coordinates"]   # [lon,lat] pairs
coords = [(c[1], c[0]) for c in geom]               # -> (lat, lon)
full_one_way = sum(hav(coords[i], coords[i+1]) for i in range(len(coords)-1))
print(f"OSRM route: {len(coords)} pts, {full_one_way:.0f} m ({full_one_way/1609.344:.3f} mi)")

# 2) Trim to LEG_M
def trim(coords, target_m):
    out = [coords[0]]
    used = 0.0
    for i in range(1, len(coords)):
        seg = hav(coords[i-1], coords[i])
        if used + seg < target_m:
            out.append(coords[i]); used += seg
        else:
            frac = (target_m - used) / seg
            a, b = coords[i-1], coords[i]
            lat = a[0] + (b[0] - a[0]) * frac
            lon = a[1] + (b[1] - a[1]) * frac
            out.append((lat, lon))
            used = target_m
            break
    return out, used

leg, leg_dist = trim(coords, LEG_M)
print(f"trimmed one-way leg: {leg_dist:.0f} m ({leg_dist/1609.344:.3f} mi), {len(leg)} pts")

# 3) Stitch two out-and-back laps
back = list(reversed(leg))
# avoid duplicating the U-turn point + the start-of-lap-2 duplicate
route = leg + back[1:] + leg[1:] + back[1:]
total = sum(hav(route[i], route[i+1]) for i in range(len(route)-1))
print(f"final course: {total:.0f} m ({total/1609.344:.4f} mi)  {len(route)} pts")

# 4) Write GPX
out = HERE / "lighthouse_half_2026_course.gpx"
with out.open("w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write('<gpx version="1.1" creator="lighthouse-half-2026-mapper" '
            'xmlns="http://www.topografix.com/GPX/1/1">\n')
    f.write('  <metadata>\n')
    f.write('    <name>2026 Lighthouse Half Marathon (Long Beach, CA)</name>\n')
    f.write('    <desc>Approximate two-lap out-and-back along the Long Beach '
            'Shoreline Pedestrian/Bike Path, reconstructed from OpenStreetMap via '
            'OSRM foot routing. Start/finish: Shoreline Aquatic Park (Lions '
            'Lighthouse). Total distance trimmed to 13.1094 mi. Not the official '
            'USATF certified line.</desc>\n')
    f.write('    <time>2026-05-24T14:00:00Z</time>\n')
    f.write('  </metadata>\n')
    f.write('  <wpt lat="%.6f" lon="%.6f"><name>Start / Finish</name></wpt>\n'
            % (leg[0][0], leg[0][1]))
    f.write('  <wpt lat="%.6f" lon="%.6f"><name>Turnaround</name></wpt>\n'
            % (leg[-1][0], leg[-1][1]))
    f.write('  <trk>\n    <name>Lighthouse Half — 2 laps</name>\n    <trkseg>\n')
    for lat, lon in route:
        f.write(f'      <trkpt lat="{lat:.6f}" lon="{lon:.6f}"></trkpt>\n')
    f.write('    </trkseg>\n  </trk>\n</gpx>\n')
print("wrote", out)
