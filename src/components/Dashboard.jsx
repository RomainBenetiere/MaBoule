import { useState, useEffect } from 'react';
import { getUserSessions } from '../firebase';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Label,
} from 'recharts';
import { BarChart3, Loader2, RefreshCw, TrendingUp, Droplets, Scale } from 'lucide-react';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="backdrop-blur-xl bg-stone-900/90 border border-white/10 rounded-xl p-3 shadow-2xl text-sm space-y-1">
      <p className="text-amber-400 font-semibold">Session</p>
      <p className="text-stone-300">
        Hydration: <span className="text-white font-medium">{d.hydration?.toFixed(1)}%</span>
      </p>
      <p className="text-stone-300">
        Density: <span className="text-white font-medium">{d.density?.toFixed(3)} g/cm³</span>
      </p>
      <p className="text-stone-300">
        Volume: <span className="text-white font-medium">{d.volume?.toFixed(1)} cm³</span>
      </p>
      {d.date && (
        <p className="text-stone-500 text-xs">{d.date}</p>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorStyles = {
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colorStyles[color]} border rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs text-stone-400">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function Dashboard({ userId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getUserSessions(userId);
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const chartData = sessions
    .filter((s) => (s.xs_data?.mix?.hydration || s.xs_data?.starter_feed?.hydration) && s.ys_data?.density)
    .map((s) => ({
      hydration: (s.xs_data.mix?.hydration ?? s.xs_data.starter_feed?.hydration ?? 0) * 100,
      density: s.ys_data.density,
      volume: s.ys_data.volume,
      date: s.metadata?.completed_at?.toDate
        ? s.metadata.completed_at.toDate().toLocaleDateString()
        : '—',
    }));

  const avgHydration = chartData.length
    ? (chartData.reduce((a, b) => a + b.hydration, 0) / chartData.length).toFixed(1)
    : '—';
  const avgDensity = chartData.length
    ? (chartData.reduce((a, b) => a + b.density, 0) / chartData.length).toFixed(3)
    : '—';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Analytics Dashboard</h2>
            <p className="text-xs text-stone-500">{sessions.length} completed session{sessions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-white/20 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={BarChart3} label="Sessions" value={sessions.length} color="amber" />
        <StatCard icon={Droplets} label="Avg Hydration" value={`${avgHydration}%`} color="cyan" />
        <StatCard icon={Scale} label="Avg Density" value={avgDensity} color="violet" />
        <StatCard icon={TrendingUp} label="Data Points" value={chartData.length} color="emerald" />
      </div>

      {/* Chart */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-stone-300 mb-4">Hydration % vs Density (g/cm³)</h3>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-stone-500 text-sm space-y-2">
            <BarChart3 className="w-10 h-10 text-stone-700" />
            <p>No data yet. Complete a baking session to see analytics.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              {/* "Sweet Spot" zone */}
              <ReferenceArea
                x1={65}
                x2={80}
                y1={0.2}
                y2={0.4}
                fill="rgba(16,185,129,0.08)"
                stroke="rgba(16,185,129,0.2)"
                strokeDasharray="4 4"
                label={{ value: '🎯 Sweet Spot', position: 'insideTopLeft', fill: '#6ee7b7', fontSize: 11 }}
              />
              <XAxis
                type="number"
                dataKey="hydration"
                name="Hydration"
                tick={{ fill: '#78716c', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              >
                <Label value="Total Hydration %" position="bottom" offset={10} fill="#a8a29e" fontSize={12} />
              </XAxis>
              <YAxis
                type="number"
                dataKey="density"
                name="Density"
                tick={{ fill: '#78716c', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              >
                <Label value="Density (g/cm³)" angle={-90} position="insideLeft" offset={0} fill="#a8a29e" fontSize={12} />
              </YAxis>
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.15)' }} />
              <Scatter
                data={chartData}
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth={1}
                r={6}
                shape="circle"
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Session History */}
      {chartData.length > 0 && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-x-auto">
          <h3 className="text-sm font-semibold text-stone-300 mb-4">Session History</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 border-b border-white/5">
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-right py-2 px-4">Hydration</th>
                <th className="text-right py-2 px-4">Volume</th>
                <th className="text-right py-2 pl-4">Density</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pr-4 text-stone-300">{d.date}</td>
                  <td className="py-2.5 px-4 text-right text-amber-400 font-medium">{d.hydration.toFixed(1)}%</td>
                  <td className="py-2.5 px-4 text-right text-violet-400 font-medium">{d.volume.toFixed(1)} cm³</td>
                  <td className="py-2.5 pl-4 text-right text-cyan-400 font-medium">{d.density.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
