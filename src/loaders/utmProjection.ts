const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_K0 = 0.9996;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface UtmPoint {
  easting: number;
  northing: number;
}

export function utmCentralMeridianRad(zone: number): number {
  return (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
}

export function utmZoneFromSourceCrs(
  sourceCrs: string | undefined,
): number | null {
  const match = /^EPSG:(269|326|327)(\d{2})$/i.exec(sourceCrs?.trim() ?? "");
  if (!match) return null;
  const zone = Number.parseInt(match[2], 10);
  return zone >= 1 && zone <= 60 ? zone : null;
}

export function latLonToUtm(
  latDeg: number,
  lonDeg: number,
  zone: number,
): UtmPoint {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const centralMeridian = utmCentralMeridianRad(zone);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = WGS84_EP2 * cosLat * cosLat;
  const a = cosLat * (lon - centralMeridian);
  const m =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256) *
      lat -
      ((3 * WGS84_E2) / 8 +
        (3 * WGS84_E2 ** 2) / 32 +
        (45 * WGS84_E2 ** 3) / 1024) *
        Math.sin(2 * lat) +
      ((15 * WGS84_E2 ** 2) / 256 + (45 * WGS84_E2 ** 3) / 1024) *
        Math.sin(4 * lat) -
      ((35 * WGS84_E2 ** 3) / 3072) * Math.sin(6 * lat));
  const easting =
    500000 +
    UTM_K0 *
      n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * WGS84_EP2) * a ** 5) / 120);
  const northing =
    UTM_K0 *
    (m +
      n *
        tanLat *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * WGS84_EP2) * a ** 6) / 720));
  return { easting, northing };
}

export function utmToLatLon(
  easting: number,
  northing: number,
  zone: number,
): LatLon {
  const x = easting - 500000;
  const y = northing;
  const centralMeridian = utmCentralMeridianRad(zone);
  const m = y / UTM_K0;
  const mu =
    m /
    (WGS84_A *
      (1 -
        WGS84_E2 / 4 -
        (3 * WGS84_E2 ** 2) / 64 -
        (5 * WGS84_E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = WGS84_EP2 * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinFp * sinFp);
  const r1 = (WGS84_A * (1 - WGS84_E2)) / (1 - WGS84_E2 * sinFp * sinFp) ** 1.5;
  const d = x / (n1 * UTM_K0);
  const lat =
    fp -
    ((n1 * tanFp) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * WGS84_EP2) * d ** 4) / 24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 * t1 -
          252 * WGS84_EP2 -
          3 * c1 * c1) *
          d ** 6) /
          720);
  const lon =
    centralMeridian +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * WGS84_EP2 + 24 * t1 * t1) *
        d ** 5) /
        120) /
      cosFp;
  return { lat: lat * RAD, lon: lon * RAD };
}

export function utmConvergenceRadians(
  easting: number,
  northing: number,
  zone: number,
): number {
  const latLon = utmToLatLon(easting, northing, zone);
  const lat = latLon.lat * DEG;
  const lon = latLon.lon * DEG;
  const centralMeridian = utmCentralMeridianRad(zone);
  return Math.atan(Math.tan(lon - centralMeridian) * Math.sin(lat));
}
