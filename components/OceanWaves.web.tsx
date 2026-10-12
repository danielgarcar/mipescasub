/**
 * Escena marina animada en canvas 2D (funciona en cualquier navegador).
 *
 * De atrás hacia delante: rayos de luz que se mecen desde la superficie, medusas, bancos de
 * peces (huyen del cursor), burbujas que suben (el cursor suelta más), algas que ondulan y
 * varias capas de olas en el fondo, más un brillo de superficie arriba.
 */
import { useEffect, useRef } from 'react';

type Bubble = { x: number; y: number; r: number; vy: number; ph: number; sp: number; life: number };
type Fish = {
  x: number; y: number; vx: number; vy: number; size: number; ph: number; baseY: number;
  color: string; dir: 1 | -1; swim: number;
};
type Jelly = { x: number; y: number; r: number; ph: number; drift: number };
type Kelp = { x: number; h: number; ph: number; w: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export default function OceanWaves() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Con "reducir movimiento" activado en el sistema la escena sigue viva, pero más lenta.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rate = reduce ? 0.4 : 1;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    let prev = 0;
    let clock = 0; // tiempo de la escena en segundos (avanza solo mientras se anima)
    const pointer = { x: -999, y: -999, on: false, at: 0 };

    let bubbles: Bubble[] = [];
    let fish: Fish[] = [];
    let jellies: Jelly[] = [];
    let kelp: Kelp[] = [];

    const school = (n: number, color: string, size: number, y: number, dir: 1 | -1, speed: number) => {
      const lead = dir === 1 ? rnd(-w * 0.2, w * 0.6) : rnd(w * 0.4, w * 1.2);
      for (let i = 0; i < n; i++) {
        fish.push({
          x: lead - dir * rnd(0, 120), y: y + rnd(-45, 45), vx: dir * speed * rnd(0.85, 1.15), vy: 0,
          size: size * rnd(0.8, 1.2), ph: rnd(0, 6.28), baseY: y + rnd(-45, 45), color, dir, swim: rnd(6, 9),
        });
      }
    };

    const build = () => {
      const small = w < 560;
      bubbles = Array.from({ length: small ? 28 : 55 }, () => spawnBubble(rnd(0, w), rnd(0, h)));
      fish = [];
      school(small ? 5 : 8, 'rgba(137,222,240,', small ? 7 : 9, h * 0.3, 1, 38);
      school(small ? 4 : 6, 'rgba(255,138,107,', small ? 9 : 12, h * 0.62, -1, 30);
      school(small ? 3 : 5, 'rgba(255,194,75,', small ? 6 : 8, h * 0.48, 1, 52);
      jellies = [
        { x: w * 0.14, y: h * 0.45, r: small ? 16 : 24, ph: 0, drift: 0.5 },
        { x: w * 0.86, y: h * 0.34, r: small ? 12 : 18, ph: 2, drift: 0.7 },
      ];
      kelp = Array.from({ length: Math.ceil(w / 70) }, (_, i) => ({
        x: i * 70 + rnd(-20, 20), h: rnd(70, 160), ph: rnd(0, 6.28), w: rnd(4, 7),
      }));
    };

    const spawnBubble = (x: number, y: number): Bubble => ({
      x, y, r: rnd(2, 7), vy: rnd(14, 38), ph: rnd(0, 6.28), sp: rnd(0.8, 1.8), life: 1,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    /* ----------------------------- dibujo de cada capa ----------------------------- */

    const rays = (t: number) => {
      for (let i = 0; i < 6; i++) {
        const x0 = w * (0.05 + i * 0.19) + Math.sin(t * 0.18 + i * 1.7) * 50;
        const width = 50 + 40 * Math.sin(t * 0.3 + i);
        const skew = w * 0.16 + Math.sin(t * 0.22 + i) * 40;
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.95);
        g.addColorStop(0, 'rgba(160,235,255,0.16)');
        g.addColorStop(1, 'rgba(160,235,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + width, 0);
        ctx.lineTo(x0 + width + skew + width * 1.4, h * 0.95);
        ctx.lineTo(x0 + skew - width * 0.4, h * 0.95);
        ctx.closePath();
        ctx.fill();
      }
    };

    const jelly = (j: Jelly, t: number) => {
      const pulse = Math.sin(t * 1.6 + j.ph);
      const r = j.r * (1 + pulse * 0.1);
      const cx = j.x + Math.sin(t * 0.25 * j.drift + j.ph) * 30;
      const cy = j.y + Math.sin(t * 0.4 * j.drift + j.ph) * 26 - pulse * 3;
      ctx.save();
      ctx.shadowColor = 'rgba(160,225,255,0.55)';
      ctx.shadowBlur = 22;
      const g = ctx.createRadialGradient(cx, cy - r * 0.3, 1, cx, cy, r * 1.2);
      g.addColorStop(0, 'rgba(220,245,255,0.55)');
      g.addColorStop(1, 'rgba(120,190,235,0.18)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * (0.78 - pulse * 0.06), 0, Math.PI, 0);
      ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.28, cx, cy + r * 0.18);
      ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.28, cx - r, cy);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(190,235,255,0.35)';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) {
        const sx = cx - r * 0.7 + (k * r * 1.4) / 5;
        ctx.beginPath();
        ctx.moveTo(sx, cy + r * 0.12);
        for (let s = 1; s <= 6; s++) {
          ctx.lineTo(sx + Math.sin(t * 1.8 + k + s * 0.7) * (s * 2.2), cy + r * 0.12 + s * (r * 0.5));
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawFish = (f: Fish, t: number) => {
      const sw = Math.sin(t * f.swim + f.ph) * f.size * 0.3;
      const alpha = 0.62;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.dir, 1);
      ctx.rotate(Math.max(-0.5, Math.min(0.5, (f.vy / 60) * f.dir)) * 0.6);
      ctx.fillStyle = `${f.color}${alpha})`;
      // cuerpo
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size, f.size * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      // cola
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.8, 0);
      ctx.lineTo(-f.size * 1.55, -f.size * 0.5 + sw);
      ctx.lineTo(-f.size * 1.55, f.size * 0.5 + sw);
      ctx.closePath();
      ctx.fill();
      // aleta dorsal
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.2, -f.size * 0.4);
      ctx.lineTo(f.size * 0.2, -f.size * 0.75 + sw * 0.2);
      ctx.lineTo(f.size * 0.45, -f.size * 0.38);
      ctx.fill();
      // ojo y brillo del vientre
      ctx.fillStyle = 'rgba(2,22,39,0.8)';
      ctx.beginPath();
      ctx.arc(f.size * 0.55, -f.size * 0.08, f.size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, f.size * 0.18, f.size * 0.7, f.size * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const bubble = (b: Bubble) => {
      ctx.strokeStyle = `rgba(190,240,255,${0.5 * b.life})`;
      ctx.fillStyle = `rgba(190,240,255,${0.08 * b.life})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.65 * b.life})`;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.2), 0, Math.PI * 2);
      ctx.fill();
    };

    const kelpBlade = (k: Kelp, t: number) => {
      const base = h + 4;
      ctx.strokeStyle = 'rgba(25,150,125,0.5)';
      ctx.lineCap = 'round';
      const segs = 9;
      let px = k.x;
      let py = base;
      for (let s = 1; s <= segs; s++) {
        const f = s / segs;
        const nx = k.x + Math.sin(t * 0.9 + k.ph + s * 0.45) * (f * 22);
        const ny = base - f * k.h;
        ctx.lineWidth = k.w * (1 - f * 0.7);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        px = nx;
        py = ny;
      }
    };

    const waveLayer = (t: number, y0: number, amp: number, len: number, speed: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) {
        const y =
          y0 +
          Math.sin(x / len + t * speed) * amp +
          Math.sin(x / (len * 0.47) - t * speed * 1.3) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };

    const surface = (t: number) => {
      // brillo de la superficie vista desde abajo
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.14);
      g.addColorStop(0, 'rgba(190,245,255,0.30)');
      g.addColorStop(1, 'rgba(190,245,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= w + 8; x += 8) {
        ctx.lineTo(x, h * 0.035 + Math.sin(x / 90 + t * 0.9) * 6 + Math.sin(x / 41 - t * 1.4) * 3);
      }
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();
    };

    /* --------------------------------- bucle --------------------------------- */

    const frame = (now: number) => {
      raf = 0;
      const dt = (prev ? Math.min(0.05, (now - prev) / 1000) : 0.016) * rate;
      prev = now;
      clock += dt;
      const t = clock;
      ctx.clearRect(0, 0, w, h);

      // física
      for (const f of fish) {
        f.x += f.vx * dt;
        f.vy *= 0.94;
        f.vy += (f.baseY + Math.sin(t * 0.6 + f.ph) * 14 - f.y) * dt * 1.2;
        if (pointer.on) {
          const dx = f.x - pointer.x;
          const dy = f.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 150 && d > 1) {
            const push = (1 - d / 150) * 340 * dt;
            f.vy += (dy / d) * push;
            f.x += (dx / d) * push * 0.6;
          }
        }
        f.y += f.vy * dt;
        if (f.dir === 1 && f.x > w + 60) f.x = -60 - rnd(0, 80);
        if (f.dir === -1 && f.x < -60) f.x = w + 60 + rnd(0, 80);
      }
      for (const b of bubbles) {
        b.y -= b.vy * dt;
        b.x += Math.sin(t * b.sp + b.ph) * 12 * dt;
        if (pointer.on) {
          const dx = b.x - pointer.x;
          const dy = b.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 90 && d > 1) b.x += (dx / d) * (1 - d / 90) * 80 * dt;
        }
        if (b.y < -10 || b.life <= 0) Object.assign(b, spawnBubble(rnd(0, w), h + 10));
      }

      rays(t);
      for (const j of jellies) jelly(j, t);
      for (const f of fish) drawFish(f, t);
      for (const b of bubbles) bubble(b);
      for (const k of kelp) kelpBlade(k, t);
      waveLayer(t, h * 0.9, 9, 70, 0.9, 'rgba(8,60,95,0.55)');
      waveLayer(t, h * 0.935, 8, 52, -1.2, 'rgba(6,44,76,0.7)');
      waveLayer(t, h * 0.97, 6, 38, 1.5, 'rgba(3,28,52,0.85)');
      surface(t);

      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointer.on = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      pointer.x = x;
      pointer.y = y;
      const now = performance.now();
      if (pointer.on && now - pointer.at > 90) {
        pointer.at = now;
        if (bubbles.length < 130) bubbles.push(spawnBubble(x + rnd(-8, 8), y + rnd(-4, 8)));
      }
      wake();
    };
    const onLeave = () => {
      pointer.on = false;
    };

    resize();
    wake();
    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) wake();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  );
}
