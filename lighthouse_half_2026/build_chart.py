"""Build CSV + finish-time distribution chart for the 2026 Lighthouse Half Marathon (Long Beach)."""
import json, csv, re
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

HERE = Path(__file__).parent
# Half-marathon results (subEvent 283500). Re-fetch via build_roster.py's curl note.
raw = json.loads((HERE / "results_raw_283500.json").read_text())
rows = raw["data"]

def to_minutes(t):
    if not t:
        return None
    parts = [float(p) for p in t.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, s = parts
    return h * 60 + m + s / 60

def pace_to_min(p):
    if not p:
        return None
    p = p.strip()
    m = re.match(r"(\d+):(\d+)", p)
    if not m:
        return None
    return int(m.group(1)) + int(m.group(2)) / 60

clean = []
for r in rows:
    chip = r.get("chipTime") or ""
    name = (r.get("name") or "").strip()
    cm = to_minutes(chip)
    final = (r.get("finalTime") or "").strip()
    # Filter junk: no real finish time recorded, placeholder names, impossible times
    if not final or name.lower() == "see timer":
        continue
    if cm is not None and (cm < 70 or cm > 300):
        continue
    clean.append({
        "place": r.get("overallPlace"),
        "bib": r.get("bib"),
        "name": name,
        "gender": r.get("gender"),
        "age": r.get("age"),
        "city": r.get("fromCity"),
        "state": r.get("fromProvState"),
        "chip_time": chip,
        "chip_minutes": cm,
        "pace_min_per_mi": pace_to_min(r.get("overallPace")),
        "lap1": r.get("segmentSplitTime733289"),
        "lap2": r.get("segmentSplitTime733290"),
    })
clean.sort(key=lambda x: x["chip_minutes"] if x["chip_minutes"] is not None else 9e9)
for i, c in enumerate(clean, 1):
    c["rank_by_chip"] = i

# CSV
with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(clean[0].keys()))
    w.writeheader()
    w.writerows(clean)

times = np.array([c["chip_minutes"] for c in clean if c["chip_minutes"]])
paces = np.array([c["pace_min_per_mi"] for c in clean if c["pace_min_per_mi"]])
genders = [c["gender"] for c in clean if c["chip_minutes"]]
m_times = np.array([t for t, g in zip(times, genders) if g == "Male"])
f_times = np.array([t for t, g in zip(times, genders) if g == "Female"])

# Stats
print(f"Finishers: {len(times)}")
print(f"  Male: {len(m_times)}  Female: {len(f_times)}")
print(f"  Fastest: {times.min():.1f} min  ({times.min()//60:.0f}h{times.min()%60:.1f}m)")
print(f"  Median:  {np.median(times):.1f} min")
print(f"  Slowest: {times.max():.1f} min")
print(f"  Median pace: {np.median(paces):.2f} min/mi")

# ----- Chart -----
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.edgecolor": "#2a2a2a",
    "axes.labelcolor": "#2a2a2a",
    "xtick.color": "#2a2a2a",
    "ytick.color": "#2a2a2a",
})

fig, ax = plt.subplots(figsize=(10, 6), dpi=200)
fig.patch.set_facecolor("#fdf8f1")
ax.set_facecolor("#fdf8f1")

bins = np.arange(np.floor(times.min() / 5) * 5,
                 np.ceil(times.max() / 5) * 5 + 5, 5)

ax.hist([m_times, f_times], bins=bins, stacked=True,
        color=["#3a6ea5", "#e58a5b"],
        edgecolor="#fdf8f1", linewidth=1.2,
        label=[f"Male (n={len(m_times)})", f"Female (n={len(f_times)})"])

med = np.median(times)
ax.axvline(med, color="#2a2a2a", linestyle="--", linewidth=1.5, alpha=0.7)
ax.text(med + 1, ax.get_ylim()[1] * 0.92,
        f"  median  {int(med//60)}:{int(med%60):02d}",
        fontsize=10, color="#2a2a2a")

# X axis as H:MM
def fmt(x, _):
    return f"{int(x // 60)}:{int(x % 60):02d}"
ax.xaxis.set_major_formatter(plt.FuncFormatter(fmt))
ax.set_xticks(np.arange(60, 240, 15))
ax.set_xlim(times.min() - 5, times.max() + 5)

ax.set_xlabel("Chip time (h:mm)", fontsize=11)
ax.set_ylabel("Finishers", fontsize=11)
ax.set_title("2026 Lighthouse Half Marathon — Long Beach, CA",
             fontsize=15, fontweight="bold", pad=14)
fig.text(0.5, 0.91, f"May 24, 2026  ·  {len(times)} finishers  ·  median {int(med//60)}:{int(med%60):02d}",
         ha="center", fontsize=10, color="#555")

ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.grid(axis="y", color="#dcd5c9", linewidth=0.7, alpha=0.7)
ax.set_axisbelow(True)
ax.legend(frameon=False, loc="upper right")

plt.tight_layout(rect=[0, 0, 1, 0.93])
plt.savefig(HERE / "finish_time_distribution.png",
            facecolor=fig.get_facecolor(), dpi=200)
print("Wrote results.csv and finish_time_distribution.png")

# ----- Pace chart -----
fig2, ax2 = plt.subplots(figsize=(10, 6), dpi=200)
fig2.patch.set_facecolor("#fdf8f1")
ax2.set_facecolor("#fdf8f1")
pbins = np.arange(np.floor(paces.min() * 2) / 2,
                  np.ceil(paces.max() * 2) / 2 + 0.5, 0.5)
m_paces = np.array([p for p, g in zip(paces, genders) if g == "Male"])
f_paces = np.array([p for p, g in zip(paces, genders) if g == "Female"])
ax2.hist([m_paces, f_paces], bins=pbins, stacked=True,
         color=["#3a6ea5", "#e58a5b"],
         edgecolor="#fdf8f1", linewidth=1.2,
         label=[f"Male (n={len(m_paces)})", f"Female (n={len(f_paces)})"])
medp = np.median(paces)
ax2.axvline(medp, color="#2a2a2a", linestyle="--", linewidth=1.5, alpha=0.7)
ax2.text(medp + 0.1, ax2.get_ylim()[1] * 0.92,
         f"  median  {int(medp)}:{int((medp%1)*60):02d}/mi",
         fontsize=10, color="#2a2a2a")
def fmt2(x, _):
    return f"{int(x)}:{int((x%1)*60):02d}"
ax2.xaxis.set_major_formatter(plt.FuncFormatter(fmt2))
ax2.set_xlabel("Pace (min/mile)", fontsize=11)
ax2.set_ylabel("Finishers", fontsize=11)
ax2.set_title("2026 Lighthouse Half Marathon — Pace Distribution",
              fontsize=15, fontweight="bold", pad=14)
fig2.text(0.5, 0.91,
          f"May 24, 2026  ·  {len(paces)} finishers  ·  median pace {int(medp)}:{int((medp%1)*60):02d}/mi",
          ha="center", fontsize=10, color="#555")
ax2.spines["top"].set_visible(False)
ax2.spines["right"].set_visible(False)
ax2.grid(axis="y", color="#dcd5c9", linewidth=0.7, alpha=0.7)
ax2.set_axisbelow(True)
ax2.legend(frameon=False, loc="upper right")
plt.tight_layout(rect=[0, 0, 1, 0.93])
plt.savefig(HERE / "pace_distribution.png",
            facecolor=fig2.get_facecolor(), dpi=200)
print("Wrote pace_distribution.png")
