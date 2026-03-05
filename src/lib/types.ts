export interface TrackPoint {
  lat: number;
  lon: number;
}

export interface Run {
  id: string;
  name: string;
  startTime: string; // ISO string
  endTime: string | null;
  distanceKm: number;
  points: TrackPoint[];
}

// Shape of runs.json from build-runs script
export interface RunsData {
  runs: {
    id: string;
    name: string;
    startTime: string;
    endTime: string | null;
    distanceKm: number;
    points: [number, number][];
  }[];
}
