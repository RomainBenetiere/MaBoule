import { useState } from 'react';
import { setUserPreferences } from '../firebase';
import { Droplets, ArrowRight, Loader2 } from 'lucide-react';

export default function FirstRunSetup({ userId, onComplete }) {
  const [hydration, setHydration] = useState(100);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setUserPreferences(userId, { initialHydration: hydration / 100 });
      onComplete(hydration / 100);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-amber-950/40 to-stone-950 p-4">
      <div className="absolute top-32 right-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-[130px]" />

      <div className="relative w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/25">
            <Droplets className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Welcome, Baker!</h2>
          <p className="text-stone-400 text-sm mt-1 text-center max-w-sm">
            Before we start, let&apos;s calibrate your sourdough starter.
            Set the hydration of your <strong className="text-stone-200">mother sourdough</strong>.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="flex items-center justify-between text-sm text-stone-300 mb-3">
              <span>Initial Mother Sourdough Hydration</span>
              <span className="text-2xl font-bold text-amber-400">{hydration}%</span>
            </label>
            <input
              id="initial-hydration-slider"
              type="range"
              min="50"
              max="200"
              step="1"
              value={hydration}
              onChange={(e) => setHydration(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-white/10 accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-stone-500 mt-1">
              <span>50% (stiff)</span>
              <span>100% (equal)</span>
              <span>200% (liquid)</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-stone-400">
            <p>
              <strong className="text-stone-200">Tip:</strong> Most sourdough starters are
              maintained at <span className="text-amber-400 font-semibold">100%</span> hydration
              (equal parts flour and water by weight). Adjust if yours differs.
            </p>
          </div>

          <button
            id="first-run-confirm"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
