/**
 * Generadores clásicos de tablas CO2 / O2 (subset de la metodología de
 * Freedivers: tablas estáticas con columnas de apnea y preparación).
 *
 * CO2: fijamos hold (p.ej. 2:00) y vamos REBAJANDO la preparación 15s cada serie.
 * O2 : fijamos prepare (2:00) y vamos SUBIENDO la apnea 15s cada serie.
 */

import type { ApneaSegment, ApneaTable } from '@/types';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** CO2 table: apnea fija (hold) y preparación decreciente. */
export function buildCo2Table(holdSec = 120, series = 8, stepSec = 15): ApneaTable {
  const seg: ApneaSegment[] = [];
  for (let i = 0; i < series; i++) {
    const prepare = Math.max(holdSec, holdSec - stepSec * i);
    seg.push({ holdSec, prepareSec: prepare, fase: 'apnea' as const, serie: i + 1 });
  }
  return {
    tipo: 'co2',
    nombre: 'Tabla CO₂',
    descripcion: 'Hold fijo, preparación decreciente (tolerancia al CO₂).',
    series: seg,
  };
}

/** O2 table: preparación fija (2 min respiración) y apnea creciente. */
export function buildO2Table(startSec = 120, series = 8, stepSec = 15): ApneaTable {
  const seg: ApneaSegment[] = [];
  for (let i = 0; i < series; i++) {
    const hold = startSec + stepSec * i;
    seg.push({ holdSec: hold, prepareSec: startSec, fase: 'apnea' as const, serie: i + 1 });
  }
  return {
    tipo: 'o2',
    nombre: 'Tabla O₂',
    descripcion: 'Preparación fija, apneas progresivas (adaptación a la hipoxia).',
    series: seg,
  };
}

/** Formatea segundos en m:ss. */
export function fmtTime(sec: number): string {
  return fmt(Math.max(0, sec));
}

/** Lista lista de tablas pre-construidas para el selector de la pantalla. */
export default function buildTables(): ApneaTable[] {
  return [buildCo2Table(), buildO2Table()];
}
