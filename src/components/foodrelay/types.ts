/* The shape scripts/food-relays/build-courses.mjs writes into each
 * course's courseData.ts. */

export type Stop = {
  /** 1-based, in running order. */
  n: number;
  name: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  /** Miles from the start to this stop's door. */
  mi: number;
  /** Miles from the stop before it (0 at the start). */
  legMi: number;
  /** Saturday opening hour on the store page; "24" is a 24-hour store. */
  opens?: string;
};

export type Course = {
  totalMi: number;
  totalKm: number;
  /** A loop comes back to stop 1; closeMi is that last hop. */
  loop: boolean;
  closeMi: number;
  stops: Stop[];
  /** [lon, lat], simplified for the chart. The GPX carries every point. */
  line: number[][];
  /** [mile, feet] along the line. */
  profile: number[][];
  highFt: number;
  lowFt: number;
  generated: string;
};
