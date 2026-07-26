// OSM2World emits a local metric projection whose origin is not documented.
// These constants were solved empirically: two calibration buildings of known
// height were injected at known lat/lon, rebuilt, and located in the mesh by
// height. Verified against a third point (Sather Tower) to ~1.4 m.
//
//   world.x = (lon - ORIGIN_LON) * M_PER_LON
//   world.z = -(lat - ORIGIN_LAT) * M_PER_LAT      // -Z is north
//
// Re-solve these if the campus GLB is ever rebuilt from a different .osm whose
// <bounds> differ, since the projection origin derives from the data bounds.
// Solved by osm2world-040/calibrate.ps1 against map(1).osm
// (bounds 37.86791..37.87555, -122.26667..-122.25213).
export const ORIGIN_LAT = 37.87172995;
export const ORIGIN_LON = -122.2594;
export const M_PER_LON = 87874;
export const M_PER_LAT = 111320.7;

export function toWorld(lat, lon) {
  return {
    x: (lon - ORIGIN_LON) * M_PER_LON,
    z: -(lat - ORIGIN_LAT) * M_PER_LAT,
  };
}

export function toLatLon(x, z) {
  return {
    lat: ORIGIN_LAT - z / M_PER_LAT,
    lon: ORIGIN_LON + x / M_PER_LON,
  };
}
