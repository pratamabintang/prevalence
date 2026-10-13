const https = require('https');
const fs = require('fs');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function decodeTopo(topo, objectKey) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  function getArc(idx) {
    if (idx >= 0) return arcs[idx];
    return arcs[~idx].slice().reverse();
  }
  return topo.objects[objectKey].geometries.map(g => {
    let coordinates = [];
    if (g.type === 'Polygon') {
      coordinates = g.arcs.map(ring => {
        let pts = [];
        ring.forEach(arcIdx => pts.push(...getArc(arcIdx)));
        return pts;
      });
    } else if (g.type === 'MultiPolygon') {
      coordinates = g.arcs.map(poly => {
        return poly.map(ring => {
          let pts = [];
          ring.forEach(arcIdx => pts.push(...getArc(arcIdx)));
          return pts;
        });
      });
    }
    return { id: g.id, properties: g.properties, type: g.type, coordinates };
  });
}

async function run() {
  console.log('Fetching TopoJSON sources...');
  const jatengTopo = await fetchJson('https://raw.githubusercontent.com/ghapsara/indonesia-atlas/master/kabupaten-kota/Jawa%20Tengah/jawa-tengah-simplified-topo.json');
  const provTopo = await fetchJson('https://raw.githubusercontent.com/ghapsara/indonesia-atlas/master/provinsi/provinces-simplified-topo.json');

  const jatengGeoms = decodeTopo(jatengTopo, Object.keys(jatengTopo.objects)[0]);
  const provGeoms = decodeTopo(provTopo, Object.keys(provTopo.objects)[0]);

  // Main Map Coordinate System: Central Java & Neighbors
  // Lon: 108.45 to 111.75
  // Lat: -8.30 to -6.35
  const W = 780, H = 450, pad = 24;
  const minLon = 108.45, maxLon = 111.75;
  const minLat = -8.30, maxLat = -6.35;

  function toSvgMain(lon, lat) {
    const x = pad + ((lon - minLon) / (maxLon - minLon)) * (W - 2 * pad);
    const y = H - pad - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * pad);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  function ringToPath(ring, proj) {
    if (!ring.length) return '';
    const start = proj(ring[0][0], ring[0][1]);
    let d = `M ${start[0]} ${start[1]}`;
    for (let i = 1; i < ring.length; i++) {
      const pt = proj(ring[i][0], ring[i][1]);
      d += ` L ${pt[0]} ${pt[1]}`;
    }
    return d + ' Z';
  }

  function geomToPath(geom, proj) {
    let parts = [];
    if (geom.type === 'Polygon') {
      parts = geom.coordinates.map(r => ringToPath(r, proj));
    } else if (geom.type === 'MultiPolygon') {
      parts = geom.coordinates.map(poly => poly.map(r => ringToPath(r, proj)).join(' '));
    }
    return parts.join(' ');
  }

  // Neighbor provinces in Main Map
  const neighbors = provGeoms.filter(g => ['Jawa Barat', 'Yogyakarta', 'Jawa Timur'].includes(g.properties.provinsi));
  const neighborPaths = neighbors.map(g => ({
    name: g.properties.provinsi,
    pathD: geomToPath(g, toSvgMain)
  }));

  // Java Island Overview Map (Full island)
  // Lon: 105.0 to 114.8
  // Lat: -8.9 to -5.8
  const jW = 600, jH = 150, jPad = 15;
  function toSvgJava(lon, lat) {
    const x = jPad + ((lon - 105.0) / (114.8 - 105.0)) * (jW - 2 * jPad);
    const y = jH - jPad - ((lat - (-8.9)) / (-5.8 - (-8.9))) * (jH - 2 * jPad);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  const javaProvinces = provGeoms.filter(g => ['Banten', 'Jawa Barat', 'Jawa Tengah', 'Yogyakarta', 'Jawa Timur'].includes(g.properties.provinsi));
  const javaOverview = javaProvinces.map(g => ({
    name: g.properties.provinsi,
    isJateng: g.properties.provinsi === 'Jawa Tengah',
    pathD: geomToPath(g, toSvgJava)
  }));

  // 35 Central Java Districts
  const rawData = JSON.parse(fs.readFileSync('src/app/core/stunting-dashboard/stunting-dashboard-data.json', 'utf8'));
  const districtFeatures = [];

  rawData.coordinates.forEach(c => {
    const orig = c.kabupaten_kota;
    const clean = orig.replace('KABUPATEN ', '').replace('KOTA ', '');
    const isKota = orig.startsWith('KOTA ');
    const geom = jatengGeoms.find(g => {
      const gName = g.properties.kabkot.toLowerCase();
      if (isKota) return g.id.startsWith('33-7') && gName === clean.toLowerCase();
      return !g.id.startsWith('33-7') && gName === clean.toLowerCase();
    });

    if (!geom) {
      console.error('Missing geom for', orig);
      return;
    }

    const lon = c.lon ?? c.longitude;
    const lat = c.lat ?? c.latitude;
    const pathD = geomToPath(geom, toSvgMain);
    const svgCenter = toSvgMain(lon, lat);

    districtFeatures.push({
      id: geom.id,
      kabupatenKota: orig,
      displayName: clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(),
      isKota: isKota,
      pathD: pathD,
      centroidLon: lon,
      centroidLat: lat,
      svgCenterX: svgCenter[0],
      svgCenterY: svgCenter[1]
    });
  });

  console.log('District features built:', districtFeatures.length);
  console.log('Neighbor paths:', neighborPaths.length);
  console.log('Java overview paths:', javaOverview.length);

  const fileContent = `export interface DistrictMapFeature {
  id: string;
  kabupatenKota: string;
  displayName: string;
  isKota: boolean;
  pathD: string;
  centroidLon: number;
  centroidLat: number;
  svgCenterX: number;
  svgCenterY: number;
}

export interface NeighborProvince {
  name: string;
  pathD: string;
}

export interface JavaOverviewProvince {
  name: string;
  isJateng: boolean;
  pathD: string;
}

export const MAIN_MAP_VIEWBOX = '0 0 ${W} ${H}';
export const JAVA_MAP_VIEWBOX = '0 0 ${jW} ${jH}';

export const NEIGHBOR_PROVINCES: NeighborProvince[] = ${JSON.stringify(neighborPaths, null, 2)};

export const JAVA_OVERVIEW_PROVINCES: JavaOverviewProvince[] = ${JSON.stringify(javaOverview, null, 2)};

export const CENTRAL_JAVA_DISTRICTS: DistrictMapFeature[] = ${JSON.stringify(districtFeatures, null, 2)};
`;

  fs.writeFileSync('src/app/core/stunting-dashboard/stunting-map-data.ts', fileContent, 'utf8');
  console.log('Wrote src/app/core/stunting-dashboard/stunting-map-data.ts successfully.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
