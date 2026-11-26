import { useCallback, useEffect, useRef, useState } from 'react';
import { apiTelemetry } from '../api';
import type { Config, MovimientoKey, Telemetry } from '../types';

type ScenarioKey = 'normal' | 'taqui' | 'hipox' | 'caida' | 'fiebre';

const SCENARIOS: Record<ScenarioKey, { hr: number; sp: number; mv: MovimientoKey; ac: number }> = {
  normal: { hr: 74, sp: 98, mv: 'reposo', ac: 1.0 },
  taqui:  { hr: 128, sp: 95, mv: 'reposo', ac: 1.0 },
  hipox:  { hr: 108, sp: 86, mv: 'reposo', ac: 1.0 },
  caida:  { hr: 96,  sp: 96, mv: 'caida',  ac: 2.9 },
  fiebre: { hr: 112, sp: 95, mv: 'temblor', ac: 1.2 },
};

const INITIAL: Telemetry = { hr: null, sp: null, mv: 'reposo', ac: null, src: 'demo', last: 0 };

function simulate(scenario: ScenarioKey): Telemetry {
  const b = SCENARIOS[scenario];
  const n = () => Math.random() * 2 - 1;
  return {
    hr: Math.round(b.hr + n() * 3),
    sp: Math.max(70, Math.min(100, Math.round(b.sp + n() * 0.8))),
    mv: b.mv,
    ac: parseFloat((b.ac + n() * 0.05).toFixed(2)),
    src: 'demo',
    last: Date.now(),
  };
}

export function useTelemetry(config: Config) {
  const [telemetry, setTelemetry] = useState<Telemetry>(INITIAL);
  const [scenario, setScenario] = useState<ScenarioKey>('normal');
  const [devOnline, setDevOnline] = useState(false);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const tick = useCallback(async () => {
    if (config.url) {
      try {
        const d = await apiTelemetry(config.url, config.dev);
        if (d?.ts && Date.now() - d.ts < 15000) {
          setTelemetry({
            hr: d.fc ?? null,
            sp: d.spo2 ?? null,
            mv: (d.movimiento as MovimientoKey) ?? 'reposo',
            ac: d.acel ?? null,
            src: 'dev',
            last: d.ts,
          });
          setDevOnline(true);
          return;
        }
      } catch { /* fallthrough to sim */ }
    }
    setDevOnline(false);
    setTelemetry(simulate(scenarioRef.current));
  }, [config.url, config.dev]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  return { telemetry, devOnline, scenario, setScenario };
}
