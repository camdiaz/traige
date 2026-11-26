import { useEffect, useRef } from 'react';
import type { Telemetry } from '../types';

type ScenarioKey = 'normal' | 'taqui' | 'hipox' | 'caida' | 'fiebre';

interface Props {
  telemetry: Telemetry;
  devOnline: boolean;
  scenario: ScenarioKey;
  onScenarioChange: (s: ScenarioKey) => void;
}

export function VitalMonitor({ telemetry, devOnline, scenario, onScenarioChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const ptsRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const hrRef = useRef(telemetry.hr ?? 70);

  useEffect(() => {
    hrRef.current = telemetry.hr ?? 70;
  }, [telemetry.hr]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function draw() {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== W * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const hr = hrRef.current;
      phaseRef.current += (hr / 60) / 60;
      const p = phaseRef.current % 1;
      const v =
        Math.exp(-Math.pow((p - 0.18) / 0.07, 2)) +
        0.35 * Math.exp(-Math.pow((p - 0.45) / 0.09, 2)) +
        0.02 * Math.sin(phaseRef.current * 9);
      ptsRef.current.push(v);
      const N = Math.max(50, Math.floor(W / 2));
      if (ptsRef.current.length > N) ptsRef.current = ptsRef.current.slice(-N);

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = '#1b2636';
      ctx.lineWidth = 1;
      for (let y = H / 4; y < H; y += H / 4) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.strokeStyle = '#3fd3f2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ptsRef.current.forEach((q, i) => {
        const x = i * (W / N);
        const y = H - 10 - q * (H - 30);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const mvText: Record<string, string> = { reposo: 'Reposo', temblor: 'Temblor', caida: '¡Caída!' };
  const mvColor = telemetry.mv === 'caida' ? '#ff6b6b' : '#dfe8f2';

  return (
    <div className="mon" aria-label="Monitor de signos vitales">
      <div className="mon-top">
        <span>
          <span className={`live${devOnline ? '' : ' off'}`} />
          {devOnline ? `ESP32 ${'' }` : 'Simulador de demostración'}
        </span>
        <label className="row" style={{ gap: 6 }}>
          Escenario
          <select
            value={scenario}
            onChange={e => onScenarioChange(e.target.value as ScenarioKey)}
            disabled={devOnline}
          >
            <option value="normal">Normal</option>
            <option value="taqui">Taquicardia</option>
            <option value="hipox">Hipoxemia</option>
            <option value="caida">Caída</option>
            <option value="fiebre">Fiebre</option>
          </select>
        </label>
      </div>
      <div className="wave">
        <canvas ref={canvasRef} />
      </div>
      <div className="vit">
        <div>
          <small>FC</small>
          <span className="n" style={{ color: 'var(--hr)' }}>{telemetry.hr ?? '--'}</span>
          <span className="u">lpm</span>
        </div>
        <div>
          <small>SpO₂</small>
          <span className="n" style={{ color: 'var(--spo)' }}>{telemetry.sp ?? '--'}</span>
          <span className="u">%</span>
        </div>
        <div>
          <small>Movimiento</small>
          <span className="n" style={{ color: mvColor, fontSize: 'clamp(26px, 3.4vw, 34px)' }}>
            {mvText[telemetry.mv] ?? '--'}
          </span>
        </div>
        <div>
          <small>Aceleración</small>
          <span className="n" style={{ color: 'var(--tmp)' }}>
            {telemetry.ac != null ? telemetry.ac.toFixed(2) : '--'}
          </span>
          <span className="u">g</span>
        </div>
      </div>
    </div>
  );
}
