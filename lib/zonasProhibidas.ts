/**
 * Límites de la pesca submarina en Galicia: dentro de las líneas que unen cada par de puntos
 * (rías) la pesca submarina está PROHIBIDA.
 *
 * Fuente: Xunta de Galicia, Sistema Integrado de Pesca Marítima de Recreo (SIPMAR),
 * "Límites y zonas prohibidas" — https://pescreativa.xunta.gal/es/node/4
 * (Decreto 211/1999, arts. 15 y 18). La web publica cada punta con sus coordenadas.
 *
 * Datum: la web da UTM huso 29 en ED50 y grados-minutos en WGS84; ambos coinciden al convertir
 * (diferencia < 3 m). Aquí están en WGS84. Dos erratas de la web corregidas con el UTM: "43º 15712’"
 * (Punta do Chans) y 66 m de diferencia en el muelle pesquero de Vigo (se usa el UTM).
 *
 * Información orientativa: no sustituye a la normativa vigente ni a la señalización.
 */

export type PuntoLimite = { nombre: string; lat: number; lng: number };
export type LimiteRia = { ria: string; tramos: PuntoLimite[][] };

export const FUENTE_LIMITES = 'https://pescreativa.xunta.gal/es/node/4';

/** Zonas sin coordenadas publicadas: radio de 250 m alrededor de estas islas. */
export const ISLAS_250M = {
  Lugo: ['Coelleiras', 'Farallóns', 'Ansarón'],
  'A Coruña': ['Aguillóns', 'Sisargas', 'Lobeiras', 'As Basoñas'],
} as const;

export const LIMITES_RIAS: LimiteRia[] = [
  {
    ria: "Ría de Ribadeo",
    tramos: [
      [
        { nombre: "Punta da Cruz", lat: 43.55648, lng: -7.02922 },
        { nombre: "Isla Pancha", lat: 43.55601, lng: -7.04074 },
      ],
    ],
  },
  {
    ria: "Ría de Viveiro",
    tramos: [
      [
        { nombre: "Punta Socastro", lat: 43.71836, lng: -7.60667 },
        { nombre: "Punta Faro", lat: 43.71147, lng: -7.58456 },
      ],
    ],
  },
  {
    ria: "Ría del Barquero",
    tramos: [
      [
        { nombre: "Punta Almeiro", lat: 43.76208, lng: -7.67487 },
        { nombre: "Punta Coba Baixa", lat: 43.74638, lng: -7.67261 },
      ],
    ],
  },
  {
    ria: "Ría de Ortigueira",
    tramos: [
      [
        { nombre: "Punta do Castro", lat: 43.73944, lng: -7.86407 },
        { nombre: "Punta Espasante", lat: 43.72644, lng: -7.81186 },
      ],
    ],
  },
  {
    ria: "Ría de Ferrol",
    tramos: [
      [
        { nombre: "Punta Redonda", lat: 43.46359, lng: -8.2702 },
        { nombre: "Punta do Vispón", lat: 43.4674, lng: -8.26762 },
      ],
    ],
  },
  {
    ria: "Ría de Ares-Betanzos",
    tramos: [
      [
        { nombre: "Punta Miranda", lat: 43.41782, lng: -8.25902 },
        { nombre: "Punta Redonda", lat: 43.39848, lng: -8.2976 },
      ],
    ],
  },
  {
    ria: "Ría de A Coruña",
    tramos: [
      [
        { nombre: "Dique Barrié", lat: 43.36511, lng: -8.37419 },
        { nombre: "Punta Mera", lat: 43.38212, lng: -8.35624 },
      ],
    ],
  },
  {
    ria: "Ría de Corme-Laxe",
    tramos: [
      [
        { nombre: "Punta do Chans", lat: 43.26187, lng: -8.97671 },
        { nombre: "Punta Cabalo", lat: 43.22932, lng: -8.98072 },
      ],
    ],
  },
  {
    ria: "Ría de Camariñas",
    tramos: [
      [
        { nombre: "Punta Villueira", lat: 43.12196, lng: -9.19256 },
        { nombre: "Punta Chorente", lat: 43.10394, lng: -9.19847 },
      ],
    ],
  },
  {
    ria: "Ría de Corcubión",
    tramos: [
      [
        { nombre: "Punta Bardullas", lat: 42.90309, lng: -9.25956 },
        { nombre: "Punta da Nasa", lat: 42.91634, lng: -9.20914 },
      ],
      [
        { nombre: "Cabo Cee", lat: 42.91607, lng: -9.18328 },
        { nombre: "Punta Galera", lat: 42.9112, lng: -9.15938 },
      ],
    ],
  },
  {
    ria: "Ría de Muros e Noia",
    tramos: [
      [
        { nombre: "Punta Reburdiño", lat: 42.77014, lng: -9.04791 },
        { nombre: "Isla de Santa Catalina", lat: 42.78335, lng: -9.01534 },
      ],
      [
        { nombre: "Isla de Santa Catalina", lat: 42.78335, lng: -9.01534 },
        { nombre: "Punta Refins do Cons", lat: 42.75871, lng: -8.9516 },
      ],
    ],
  },
  {
    ria: "Ría de Arousa",
    tramos: [
      [
        { nombre: "Punta Cabío", lat: 42.587, lng: -8.91986 },
        { nombre: "Punta Barbafeita", lat: 42.56905, lng: -8.89174 },
      ],
      [
        { nombre: "Punta Castelo", lat: 42.52581, lng: -8.87422 },
        { nombre: "Cabeza do Mouro", lat: 42.49309, lng: -8.89193 },
      ],
    ],
  },
  {
    ria: "Ría de Pontevedra",
    tramos: [
      [
        { nombre: "Punta Santa Marina", lat: 42.3932, lng: -8.76435 },
        { nombre: "Punta Chirleu", lat: 42.37666, lng: -8.73666 },
      ],
    ],
  },
  {
    ria: "Ría de Aldán",
    tramos: [
      [
        { nombre: "Punta Preguntoiro o de Bon", lat: 42.31369, lng: -8.82325 },
        { nombre: "Punta Chirleu", lat: 42.29102, lng: -8.83763 },
      ],
    ],
  },
  {
    ria: "Ría de Vigo",
    tramos: [
      [
        { nombre: "Punta Rodeira", lat: 42.25775, lng: -8.76564 },
        { nombre: "Punta sur del muelle Pesquero del Puerto de Vigo", lat: 42.23455, lng: -8.73761 },
      ],
    ],
  },
  {
    ria: "Ría de Baiona",
    tramos: [
      [
        { nombre: "Punta Lamela", lat: 42.15639, lng: -8.8502 },
        { nombre: "Punta de Boi", lat: 42.12807, lng: -8.8522 },
      ],
    ],
  },
];
