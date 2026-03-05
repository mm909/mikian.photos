// A single GPS track point from a GPX file
export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  timeUtc: Date;
  timeMs: number; // timeUtc.getTime() for fast comparisons
}

// One GPX file = one run
export interface Run {
  id: string; // filename without extension
  filename: string;
  name: string; // track name from GPX <name> tag
  points: TrackPoint[]; // sorted ascending by timeMs
  startTime: Date;
  endTime: Date;
  totalDistanceKm: number;
}

// Plain-object bounds (no Leaflet types in state)
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ---- Static manifest types ----

/** Schema of public/downtownkruz/manifest.json */
export interface DowntownkruzManifest {
  /** Filenames under public/downtownkruz/gpx/ */
  gpxFiles: string[];
}
