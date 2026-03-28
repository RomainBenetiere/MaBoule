import { useState, useEffect, useMemo } from 'react';
import {
  createSession,
  updateSessionStep,
  completeSession,
  getLastCompletedSession,
  getUserPreferences,
} from '../firebase';
import {
  calculateHydration,
  calculateSphericalCapVolume,
  calculateDensity,
} from '../utils/sourdoughMath';
import PhotoCapture from './PhotoCapture';
import {
  FlaskConical,
  Beaker,
  Droplets,
  Blend,
  Timer,
  Hand,
  Snowflake,
  Cookie,
  Flame as FireIcon,
  Flame,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Info,
  Clock,
  Hourglass,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Step definitions (10 steps)                                        */
/* ------------------------------------------------------------------ */
const STEPS = [
  { key: 'starter_feed',       label: 'Starter Feed',        icon: FlaskConical, color: 'from-amber-500 to-orange-500' },
  { key: 'levain_preparation', label: 'Levain Preparation',  icon: Beaker,       color: 'from-lime-500 to-emerald-500' },
  { key: 'autolyse',           label: 'Autolyse',            icon: Droplets,     color: 'from-sky-500 to-blue-500' },
  { key: 'mix',                label: 'Mix',                 icon: Blend,        color: 'from-violet-500 to-purple-500' },
  { key: 'bulk_fermentation',  label: 'Bulk Ferment',        icon: Timer,        color: 'from-emerald-500 to-green-500' },
  { key: 'pre_shape',          label: 'Pre-shape',           icon: Hand,         color: 'from-pink-500 to-rose-500' },
  { key: 'cold_proof',         label: 'Cold Proof',          icon: Snowflake,    color: 'from-cyan-500 to-teal-500' },
  { key: 'shape',              label: 'Shape',               icon: Cookie,       color: 'from-orange-500 to-red-500' },
  { key: 'warm_proof',         label: 'Warm Proof',          icon: FireIcon,     color: 'from-rose-500 to-orange-500' },
  { key: 'bake_measure',       label: 'Bake & Measure',      icon: Flame,        color: 'from-red-500 to-orange-500' },
];

const TOTAL_STEPS = STEPS.length;

/* ------------------------------------------------------------------ */
/*  Reusable sub-components                                            */
/* ------------------------------------------------------------------ */
function StepField({ label, unit, id, value, onChange, type = 'number', min, max, step = 'any', hint }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-stone-300 mb-1.5">
        {label} {unit && <span className="text-stone-500">({unit})</span>}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition"
      />
      {hint && <p className="text-xs text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function MetricCard({ label, value, unit, color = 'amber' }) {
  const colorMap = {
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    lime: 'from-lime-500/20 to-lime-500/5 border-lime-500/20 text-lime-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-3 text-center`}>
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorMap[color].split(' ').pop()}`}>
        {value} <span className="text-xs font-normal text-stone-500">{unit}</span>
      </p>
    </div>
  );
}

/** Timestamp & elapsed time bar shown at the top of every step */
function TimestampBar({ timestamps, currentStep }) {
  const startedAt = timestamps[currentStep];
  const elapsed = currentStep > 0 && timestamps[currentStep] && timestamps[currentStep - 1]
    ? Math.round((new Date(timestamps[currentStep]) - new Date(timestamps[currentStep - 1])) / 60000)
    : null;

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatElapsed = (mins) => {
    if (mins === null || mins === undefined) return null;
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}min` : `${h}h`;
  };

  return (
    <div className="flex items-center gap-4 text-xs text-stone-500 mb-4 bg-white/3 border border-white/5 rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-stone-600" />
        <span>Début: <span className="text-stone-300 font-medium">{formatTime(startedAt)}</span></span>
      </div>
      {elapsed !== null && (
        <div className="flex items-center gap-1.5">
          <Hourglass className="w-3.5 h-3.5 text-stone-600" />
          <span>Δt: <span className="text-amber-400 font-medium">{formatElapsed(elapsed)}</span></span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Wizard component                                              */
/* ------------------------------------------------------------------ */
export default function Wizard({ userId, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [prevHydration, setPrevHydration] = useState(1.0); // H_prev from last completed session / prefs
  const [saving, setSaving] = useState(false);
  const [timestamps, setTimestamps] = useState([]);
  const [completed, setCompleted] = useState(false);

  /* — Step data — */
  const [starterFeed, setStarterFeed] = useState({ water: 0, flour: 0, starter: 0 });
  const [levainPrep, setLevainPrep] = useState({ water: 0, flour: 0, starterFromFeed: 0 });
  const [autolyse, setAutolyse] = useState({ flour: 0, water: 0, roomTempC: 0, waterTempC: 0 });
  const [mix, setMix] = useState({ saltG: 0, mixerSpeed: '', kneadingTimeMin: 0, mixTempC: 0, notes: '' });
  const [bulkFerment, setBulkFerment] = useState({ stretchFolds: 0, startTempC: 0, endTempC: 0, notes: '' });
  const [preShape, setPreShape] = useState({ notes: '' });
  const [coldProof, setColdProof] = useState({ tempC: 4, notes: '' });
  const [shape, setShape] = useState({ technique: '' });
  const [warmProof, setWarmProof] = useState({ tempC: 25, notes: '' });
  const [bakeMeasure, setBakeMeasure] = useState({ massKg: 0, d1: 0, d2: 0, h: 0, formFactor: 1.0 });

  /* — Photo URLs — */
  const [mixPhotos, setMixPhotos] = useState([]);
  const [bakePhotos, setBakePhotos] = useState([]);

  /* — Quantities for mix hydration calc — */
  // levainQty = how much levain (from levain prep) goes into the mix. We use the entire levainPrep output.
  const levainTotalMass = levainPrep.water + levainPrep.flour + levainPrep.starterFromFeed;

  /* — Initialize session — */
  useEffect(() => {
    async function init() {
      try {
        const lastSession = await getLastCompletedSession(userId);
        if (lastSession?.xs_data?.starter_feed?.hydration) {
          setPrevHydration(lastSession.xs_data.starter_feed.hydration);
        } else {
          const prefs = await getUserPreferences(userId);
          if (prefs?.initialHydration) setPrevHydration(prefs.initialHydration);
        }
        const session = await createSession(userId);
        setSessionId(session.id);
        setTimestamps([new Date().toISOString()]);
      } catch (err) {
        console.error('Wizard init error:', err);
      }
    }
    init();
  }, [userId]);

  /* — Computed hydrations — */
  const starterHydration = useMemo(
    () => calculateHydration(starterFeed.water, starterFeed.flour, starterFeed.starter, prevHydration),
    [starterFeed, prevHydration]
  );

  const levainHydration = useMemo(
    () => calculateHydration(levainPrep.water, levainPrep.flour, levainPrep.starterFromFeed, starterHydration),
    [levainPrep, starterHydration]
  );

  // Mix hydration: W = autolyse.water, F = autolyse.flour, S = levainTotalMass, H_prev = levainHydration
  const mixHydration = useMemo(
    () => calculateHydration(autolyse.water, autolyse.flour, levainTotalMass, levainHydration),
    [autolyse.water, autolyse.flour, levainTotalMass, levainHydration]
  );

  const volume = useMemo(
    () => calculateSphericalCapVolume(bakeMeasure.d1, bakeMeasure.d2, bakeMeasure.h, bakeMeasure.formFactor),
    [bakeMeasure]
  );

  const density = useMemo(
    () => calculateDensity(bakeMeasure.massKg, volume),
    [bakeMeasure.massKg, volume]
  );

  /* — Timestamp helpers — */
  const recordTimestamp = () => {
    setTimestamps((prev) => [...prev, new Date().toISOString()]);
  };

  /* — Step data getter — */
  const getStepData = (stepIndex) => {
    switch (stepIndex) {
      case 0: return { ...starterFeed, hydration: starterHydration };
      case 1: return { ...levainPrep, hydration: levainHydration };
      case 2: return autolyse;
      case 3: return { ...mix, hydration: mixHydration, levainQty: levainTotalMass, photos: mixPhotos };
      case 4: return bulkFerment;
      case 5: return preShape;
      case 6: return coldProof;
      case 7: return shape;
      case 8: return warmProof;
      case 9: return { ...bakeMeasure, volume, density, photos: bakePhotos };
      default: return {};
    }
  };

  /* — Navigation — */
  const handleNext = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      recordTimestamp();
      const stepKey = STEPS[currentStep].key;
      const data = {
        ...getStepData(currentStep),
        timestamp: new Date().toISOString(),
      };

      if (currentStep < TOTAL_STEPS - 1) {
        await updateSessionStep(userId, sessionId, `xs_data.${stepKey}`, data);
        setCurrentStep((s) => s + 1);
      } else {
        // Final step — complete the session
        await completeSession(userId, sessionId, {
          'xs_data.starter_feed': { ...starterFeed, hydration: starterHydration, timestamp: timestamps[0] },
          'xs_data.levain_preparation': { ...levainPrep, hydration: levainHydration },
          'xs_data.mix': { ...mix, hydration: mixHydration, levainQty: levainTotalMass, photos: mixPhotos },
          'ys_data': {
            mass_kg: bakeMeasure.massKg,
            d1: bakeMeasure.d1,
            d2: bakeMeasure.d2,
            height: bakeMeasure.h,
            volume,
            density,
            form_factor: bakeMeasure.formFactor,
            photos: bakePhotos,
            timestamp: new Date().toISOString(),
          },
          'metadata.form_factor_multiplier': bakeMeasure.formFactor,
        });
        setCompleted(true);
      }
    } catch (err) {
      console.error('Save step error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  /* — Completion screen — */
  if (completed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 p-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-bounce-slow">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <MetricCard label="Mix Hydration" value={(mixHydration * 100).toFixed(1)} unit="%" color="amber" />
          <MetricCard label="Density" value={density.toFixed(3)} unit="g/cm³" color="cyan" />
          <MetricCard label="Volume" value={volume.toFixed(1)} unit="cm³" color="violet" />
          <MetricCard label="Mass" value={(bakeMeasure.massKg * 1000).toFixed(0)} unit="g" color="emerald" />
        </div>
        <button
          onClick={() => onComplete?.()}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          View Dashboard
        </button>
      </div>
    );
  }

  const StepIcon = STEPS[currentStep].icon;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-0.5 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex-1 min-w-[2rem] flex flex-col items-center">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-300 ${
                  i < currentStep
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : i === currentStep
                      ? `bg-gradient-to-br ${s.color} text-white shadow-lg`
                      : 'bg-white/5 text-stone-600'
                }`}
              >
                {i < currentStep ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`h-1 w-full mt-2 rounded-full ${
                  i < currentStep ? 'bg-emerald-500/50' : i === currentStep ? 'bg-amber-500/50' : 'bg-white/5'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Step header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${STEPS[currentStep].color} flex items-center justify-center shadow-lg`}>
          <StepIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wider">Step {currentStep + 1} of {TOTAL_STEPS}</p>
          <h2 className="text-lg font-bold text-white">{STEPS[currentStep].label}</h2>
        </div>
      </div>

      {/* Timestamp bar */}
      <TimestampBar timestamps={timestamps} currentStep={currentStep} />

      {/* Step content */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-4">

        {/* ──── Step 0: Starter Feed ──── */}
        {currentStep === 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StepField label="Water" unit="g" id="sf-water" value={starterFeed.water || ''} onChange={(v) => setStarterFeed((p) => ({ ...p, water: v }))} min={0} />
              <StepField label="Flour" unit="g" id="sf-flour" value={starterFeed.flour || ''} onChange={(v) => setStarterFeed((p) => ({ ...p, flour: v }))} min={0} />
              <StepField label="Starter" unit="g" id="sf-starter" value={starterFeed.starter || ''} onChange={(v) => setStarterFeed((p) => ({ ...p, starter: v }))} min={0} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Calculated Hydration" value={(starterHydration * 100).toFixed(1)} unit="%" color="amber" />
              <MetricCard label="Previous Hydration" value={(prevHydration * 100).toFixed(1)} unit="%" color="cyan" />
            </div>
            <div className="flex items-start gap-2 text-xs text-stone-500">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-stone-600" />
              <span>H = ((W/F)×(W+F) + S×H_prev) / (W+F+S)</span>
            </div>
          </>
        )}

        {/* ──── Step 1: Levain Preparation ──── */}
        {currentStep === 1 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StepField label="Water" unit="g" id="lp-water" value={levainPrep.water || ''} onChange={(v) => setLevainPrep((p) => ({ ...p, water: v }))} min={0} />
              <StepField label="Flour" unit="g" id="lp-flour" value={levainPrep.flour || ''} onChange={(v) => setLevainPrep((p) => ({ ...p, flour: v }))} min={0} />
              <StepField label="Starter Feed" unit="g" id="lp-starter" value={levainPrep.starterFromFeed || ''} onChange={(v) => setLevainPrep((p) => ({ ...p, starterFromFeed: v }))} min={0} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Levain Hydration" value={(levainHydration * 100).toFixed(1)} unit="%" color="lime" />
              <MetricCard label="H_prev (Starter Feed)" value={(starterHydration * 100).toFixed(1)} unit="%" color="amber" />
            </div>
            <div className="flex items-start gap-2 text-xs text-stone-500">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-stone-600" />
              <span>Uses the Starter Feed hydration as H_prev for the levain calculation.</span>
            </div>
          </>
        )}

        {/* ──── Step 2: Autolyse ──── */}
        {currentStep === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StepField label="Flour" unit="g" id="auto-flour" value={autolyse.flour || ''} onChange={(v) => setAutolyse((p) => ({ ...p, flour: v }))} min={0} />
              <StepField label="Water" unit="g" id="auto-water" value={autolyse.water || ''} onChange={(v) => setAutolyse((p) => ({ ...p, water: v }))} min={0} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StepField label="Room Temperature" unit="°C" id="auto-room-temp" value={autolyse.roomTempC || ''} onChange={(v) => setAutolyse((p) => ({ ...p, roomTempC: v }))} />
              <StepField label="Water Temperature" unit="°C" id="auto-water-temp" value={autolyse.waterTempC || ''} onChange={(v) => setAutolyse((p) => ({ ...p, waterTempC: v }))} />
            </div>
            <div className="flex items-start gap-2 text-xs text-stone-500">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-stone-600" />
              <span>Mix flour &amp; water, rest 30-60 min for gluten development.</span>
            </div>
          </>
        )}

        {/* ──── Step 3: Mix ──── */}
        {currentStep === 3 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Mix Hydration" value={(mixHydration * 100).toFixed(1)} unit="%" color="violet" />
              <MetricCard label="H_prev (Levain)" value={(levainHydration * 100).toFixed(1)} unit="%" color="lime" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StepField label="Salt" unit="g" id="mix-salt" value={mix.saltG || ''} onChange={(v) => setMix((p) => ({ ...p, saltG: v }))} min={0} />
              <StepField label="Mix Temperature" unit="°C" id="mix-temp" value={mix.mixTempC || ''} onChange={(v) => setMix((p) => ({ ...p, mixTempC: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StepField label="Mixer Speed" unit="" id="mix-speed" type="text" value={mix.mixerSpeed} onChange={(v) => setMix((p) => ({ ...p, mixerSpeed: v }))} hint="e.g. 1, 2, Low, High" />
              <StepField label="Kneading Time" unit="min" id="mix-knead" value={mix.kneadingTimeMin || ''} onChange={(v) => setMix((p) => ({ ...p, kneadingTimeMin: v }))} min={0} />
            </div>
            <StepField
              label="Notes" id="mix-notes" type="text"
              value={mix.notes}
              onChange={(v) => setMix((p) => ({ ...p, notes: v }))}
              hint="Describe how you incorporated the levain into the autolyse."
            />
            <div className="flex items-start gap-2 text-xs text-stone-500">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-stone-600" />
              <span>H = ((W_autolyse/F_autolyse)×(W+F) + Levain_qty × H_levain) / (W+F+Levain_qty)</span>
            </div>
            <PhotoCapture
              userId={userId} sessionId={sessionId} stepKey="mix"
              photos={mixPhotos} onPhotosChange={setMixPhotos}
            />
          </>
        )}

        {/* ──── Step 4: Bulk Fermentation ──── */}
        {currentStep === 4 && (
          <>
            <StepField
              label="Stretch & Folds" unit="count" id="bf-folds"
              value={bulkFerment.stretchFolds || ''} onChange={(v) => setBulkFerment((p) => ({ ...p, stretchFolds: v }))}
              min={0} step={1}
            />
            <div className="grid grid-cols-2 gap-3">
              <StepField label="Start Temperature" unit="°C" id="bf-start-temp" value={bulkFerment.startTempC || ''} onChange={(v) => setBulkFerment((p) => ({ ...p, startTempC: v }))} />
              <StepField label="End Temperature" unit="°C" id="bf-end-temp" value={bulkFerment.endTempC || ''} onChange={(v) => setBulkFerment((p) => ({ ...p, endTempC: v }))} />
            </div>
            <StepField
              label="Notes" id="bf-notes" type="text"
              value={bulkFerment.notes}
              onChange={(v) => setBulkFerment((p) => ({ ...p, notes: v }))}
              hint="Rise %, windowpane test results…"
            />
          </>
        )}

        {/* ──── Step 5: Pre-shape ──── */}
        {currentStep === 5 && (
          <StepField
            label="Notes" id="ps-notes" type="text"
            value={preShape.notes}
            onChange={(v) => setPreShape({ notes: v })}
            hint="Bench rest duration, dough feel, etc."
          />
        )}

        {/* ──── Step 6: Cold Proof (before Shape) ──── */}
        {currentStep === 6 && (
          <>
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Snowflake className="w-5 h-5" />
              <span className="text-sm font-semibold">Cold Retard / Cold Proof</span>
            </div>
            <StepField label="Temperature" unit="°C" id="cp-temp" value={coldProof.tempC || ''} onChange={(v) => setColdProof((p) => ({ ...p, tempC: v }))} />
            <StepField
              label="Notes" id="cp-notes" type="text"
              value={coldProof.notes}
              onChange={(v) => setColdProof((p) => ({ ...p, notes: v }))}
              hint="Duration, poke test, fridge location…"
            />
          </>
        )}

        {/* ──── Step 7: Shape ──── */}
        {currentStep === 7 && (
          <StepField
            label="Shaping Technique" id="shape-tech" type="text"
            value={shape.technique}
            onChange={(v) => setShape({ technique: v })}
            hint="e.g. Batard, Boule, Baguette"
          />
        )}

        {/* ──── Step 8: Warm Proof (after Shape) ──── */}
        {currentStep === 8 && (
          <>
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <FireIcon className="w-5 h-5" />
              <span className="text-sm font-semibold">Warm / Room-Temp Proof</span>
            </div>
            <StepField label="Temperature" unit="°C" id="wp-temp" value={warmProof.tempC || ''} onChange={(v) => setWarmProof((p) => ({ ...p, tempC: v }))} />
            <StepField
              label="Notes" id="wp-notes" type="text"
              value={warmProof.notes}
              onChange={(v) => setWarmProof((p) => ({ ...p, notes: v }))}
              hint="Duration, poke test result…"
            />
          </>
        )}

        {/* ──── Step 9: Bake & Measure ──── */}
        {currentStep === 9 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StepField label="Mass" unit="kg" id="bm-mass" value={bakeMeasure.massKg || ''} onChange={(v) => setBakeMeasure((p) => ({ ...p, massKg: v }))} min={0} step={0.001} />
              <StepField label="Height" unit="cm" id="bm-h" value={bakeMeasure.h || ''} onChange={(v) => setBakeMeasure((p) => ({ ...p, h: v }))} min={0} />
              <StepField label="Diameter 1" unit="cm" id="bm-d1" value={bakeMeasure.d1 || ''} onChange={(v) => setBakeMeasure((p) => ({ ...p, d1: v }))} min={0} />
              <StepField label="Diameter 2" unit="cm" id="bm-d2" value={bakeMeasure.d2 || ''} onChange={(v) => setBakeMeasure((p) => ({ ...p, d2: v }))} min={0} />
            </div>

            {/* Form Factor Slider */}
            <div>
              <label className="flex items-center justify-between text-sm text-stone-300 mb-1.5">
                <span>Form Factor</span>
                <span className="text-amber-400 font-bold">{bakeMeasure.formFactor.toFixed(2)}</span>
              </label>
              <input
                id="bm-formfactor" type="range" min="0" max="2" step="0.01"
                value={bakeMeasure.formFactor}
                onChange={(e) => setBakeMeasure((p) => ({ ...p, formFactor: parseFloat(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none bg-white/10 accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-stone-500 mt-1">
                <span>0.00</span><span>1.00 (default)</span><span>2.00</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Volume" value={volume.toFixed(1)} unit="cm³" color="violet" />
              <MetricCard label="Density" value={density.toFixed(3)} unit="g/cm³" color="cyan" />
            </div>

            <div className="flex items-start gap-2 text-xs text-stone-500">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-stone-600" />
              <span>V = (πh/6)(3r² + h²) × FormFactor, where r = (D1+D2)/4</span>
            </div>
            <PhotoCapture
              userId={userId} sessionId={sessionId} stepKey="bake_measure"
              photos={bakePhotos} onPhotosChange={setBakePhotos}
            />
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-1 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : currentStep === TOTAL_STEPS - 1 ? (
            <>Complete <Check className="w-4 h-4" /></>
          ) : (
            <>Next <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
