/**
 * Implementación web de la API de react-native-maps sobre Leaflet.
 * Metro la usa en lugar de react-native-maps cuando platform === 'web' (ver metro.config.js).
 * Leaflet se carga desde CDN en el cliente, así que el render SSR no toca `window`.
 */
import React, { createContext, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = LEAFLET_JS;
      js.onload = () => resolve((window as any).L);
      js.onerror = () => {
        leafletPromise = null;
        reject(new Error('No se pudo cargar Leaflet'));
      };
      document.head.appendChild(js);
    });
  }
  return leafletPromise;
}

/**
 * Capa de la carta ENC solo con sus datos (sondas, isóbatas, símbolos, textos), sin los
 * rellenos de color, para superponerla a la imagen de satélite. Cada tesela se descarga
 * como imagen y se hace transparente cualquier color que ocupe una parte grande de ella
 * (los rellenos de agua, tierra y bandas de profundidad).
 */
function encSymbolsLayer(L: any) {
  const Layer = L.GridLayer.extend({
    createTile(coords: any, done: any) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const size = 40075016.68557849 / Math.pow(2, coords.z);
      const minX = -20037508.342789244 + coords.x * size;
      const maxY = 20037508.342789244 - coords.y * size;
      const url =
        'https://ideihm.covam.es/ihmcache/wms?service=WMS&version=1.1.1&request=GetMap&layers=RasterENC' +
        '&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256' +
        `&bbox=${minX},${maxY - size},${minX + size},${maxY}`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const g = canvas.getContext('2d')!;
        g.drawImage(img, 0, 0);
        try {
          const data = g.getImageData(0, 0, 256, 256);
          const px = data.data;
          const counts = new Map<number, number>();
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] < 128) continue;
            const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          const limit = 256 * 256 * 0.012;
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] < 128) continue;
            const lum = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
            if (lum < 90) {
              // textos, sondas y líneas negros de la carta: en blanco para que se lean sobre el satélite
              px[i] = px[i + 1] = px[i + 2] = 255;
              continue;
            }
            const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
            if ((counts.get(key) ?? 0) > limit) px[i + 3] = 0;
          }
          g.putImageData(data, 0, 0);
        } catch {
          /* sin acceso a los píxeles: se deja la tesela tal cual */
        }
        done(null, canvas);
      };
      img.onerror = () => done(null, canvas);
      img.src = url;
      return canvas;
    },
  });
  return new Layer({
    maxZoom: 19,
    zIndex: 15,
    attribution: '&copy; Instituto Hidrográfico de la Marina (ENC) — no apta para navegación',
  });
}

type Ctx = { L: any; map: any } | null;
const MapCtx = createContext<Ctx>(null);

type LatLng = { latitude: number; longitude: number };

const MapView = React.forwardRef<any, any>(function MapView(
  { style, initialRegion, region, children, onPress, basemap = 'carta' },
  ref,
) {
  const hostRef = useRef<any>(null);
  const [ctx, setCtx] = useState<Ctx>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const mapObj = useRef<any>(null);

  // API imperativa mínima compatible con react-native-maps.
  useImperativeHandle(ref, () => ({
    animateToRegion: (r: any) => {
      const zoom = Math.max(2, Math.min(18, Math.round(Math.log2(360 / (r.latitudeDelta || 0.1)))));
      mapObj.current?.setView([r.latitude, r.longitude], zoom, { animate: true });
    },
  }));

  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        const el: HTMLElement | null = hostRef.current;
        if (cancelled || !el) return;
        const r = region ?? initialRegion ?? { latitude: 38.9, longitude: 0.48, latitudeDelta: 1.2 };
        map = L.map(el, { zoomControl: true, attributionControl: true });
        // zoom aproximado a partir del delta de latitud
        const zoom = Math.max(2, Math.min(18, Math.round(Math.log2(360 / (r.latitudeDelta || 0.1)))));
        map.setView([r.latitude, r.longitude], zoom);
        map.on('click', (e: any) => {
          onPressRef.current?.({
            nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } },
          });
        });
        mapObj.current = map;
        setCtx({ L, map });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (map) map.remove();
      setCtx(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vista base: carta náutica (OSM + ENC del IHM encima), solo OpenStreetMap o satélite (Esri).
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;
    const layers: any[] = [];
    if (basemap === 'satelite' || basemap === 'mixta') {
      layers.push(
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Imágenes &copy; Esri',
        }),
      );
    } else {
      layers.push(
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }),
      );
    }
    if (basemap === 'mixta') {
      layers.push(encSymbolsLayer(L));
    } else if (basemap === 'carta') {
      {
        // Carta náutica electrónica (ENC) oficial del IHM, la misma del visor IDEIHM.
        layers.push(
          L.tileLayer.wms('https://ideihm.covam.es/ihmcache/wms', {
            layers: 'RasterENC',
            version: '1.3.0',
            format: 'image/png',
            transparent: true,
            maxZoom: 19,
            zIndex: 15,
            attribution: '&copy; Instituto Hidrográfico de la Marina (ENC) — no apta para navegación',
          }),
        );
      }
    }
    layers.forEach((l) => l.addTo(map));
    return () => layers.forEach((l) => l.remove());
  }, [ctx, basemap]);

  // Si cambia `region` (p. ej. al obtener la posición), recentrar.
  useEffect(() => {
    const r = region ?? initialRegion;
    if (ctx && r) ctx.map.setView([r.latitude, r.longitude]);
  }, [ctx, region?.latitude, region?.longitude, initialRegion?.latitude, initialRegion?.longitude]);

  return (
    <View style={style}>
      <View ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {ctx && <MapCtx.Provider value={ctx}>{children}</MapCtx.Provider>}
    </View>
  );
});

// El WMS de la carta ENC ya se añade en MapView; este componente no hace nada en web.
export const WMSTile = (_props: any) => null;

export const UrlTile = ({ urlTemplate, maximumZ, opacity }: any) => {
  const ctx = useContext(MapCtx);
  useEffect(() => {
    if (!ctx) return;
    const url = String(urlTemplate).replace('{-y}', '{y}');
    const layer = ctx.L.tileLayer(url, {
      maxNativeZoom: maximumZ ?? 18,
      maxZoom: 19,
      opacity: opacity ?? 1,
      zIndex: 10,
    }).addTo(ctx.map);
    return () => {
      layer.remove();
    };
  }, [ctx, urlTemplate, maximumZ, opacity]);
  return null;
};

export const Marker = ({ coordinate, title, description, pinColor, onPress }: any) => {
  const ctx = useContext(MapCtx);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  useEffect(() => {
    if (!ctx) return;
    const color = pinColor ?? '#e5484d';
    const icon = ctx.L.divIcon({
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.6)"></div>`,
    });
    const m = ctx.L.marker([coordinate.latitude, coordinate.longitude], { icon }).addTo(ctx.map);
    if (title) {
      const el = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = title;
      el.appendChild(b);
      if (description) {
        const p = document.createElement('div');
        p.textContent = description;
        el.appendChild(p);
      }
      m.bindPopup(el);
    }
    m.on('click', () => onPressRef.current?.());
    return () => {
      m.remove();
    };
  }, [ctx, coordinate.latitude, coordinate.longitude, title, description, pinColor]);
  return null;
};

export const Circle = ({ center, radius, strokeColor, fillColor, strokeWidth }: any) => {
  const ctx = useContext(MapCtx);
  useEffect(() => {
    if (!ctx) return;
    const c = ctx.L.circle([center.latitude, center.longitude], {
      radius,
      color: strokeColor,
      weight: strokeWidth ?? 1,
      fillColor,
      fillOpacity: 0.2,
    }).addTo(ctx.map);
    return () => {
      c.remove();
    };
  }, [ctx, center.latitude, center.longitude, radius, strokeColor, fillColor, strokeWidth]);
  return null;
};

const Nada = (_props: any) => null;
export const Polyline = Nada;
export const Polygon = Nada;
export const Callout = Nada;
export type { LatLng };
export default MapView;
