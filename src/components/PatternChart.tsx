import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceArea, 
  ResponsiveContainer 
} from 'recharts';
import { DailyLog } from '../types/habit';
import { PredictionResult } from '../types/analytics';

export interface PatternChartProps {
  key?: string;
  habitId: string;
  habitName: string;
  logs: any[];
  prediction?: PredictionResult;
}

export function PatternChart({ habitId, habitName, logs, prediction }: PatternChartProps) {
  const data = logs
    .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime())
    .slice(-30)
    .map(log => ({
      date: new Date(log.id).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: log.value,
    }));

  const getRiskColor = () => {
    if (!prediction) return 'transparent';
    if (prediction.trendLabel === 'declining') return 'rgba(244, 63, 94, 0.1)'; // Rose
    if (prediction.trendLabel === 'at_risk') return 'rgba(245, 158, 11, 0.1)'; // Amber
    return 'rgba(16, 185, 129, 0.1)'; // Emerald
  };

  return (
    <div className="bg-bg-card border border-border-main rounded-2xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted">{habitName}</h4>
          <p className="text-[10px] text-text-muted/50">30-Day Behavior Flow</p>
        </div>
        {prediction && (
          <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
            prediction.trendLabel === 'declining' ? 'bg-rose-500/10 text-rose-500' :
            prediction.trendLabel === 'at_risk' ? 'bg-amber-500/10 text-amber-500' :
            'bg-emerald-500/10 text-emerald-500'
          }`}>
            Focus Needed: {Math.round(prediction.riskScore * 100)}%
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 9, fill: '#6b6b76' }} 
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 9, fill: '#6b6b76' }} 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1f', 
                border: '1px solid #2a2a30',
                borderRadius: '8px',
                fontSize: '10px'
              }}
              itemStyle={{ color: '#00f2fe' }}
            />
            
            {/* ML Prediction Risk Band (Last 7 days projection) */}
            {data.length > 7 && (
              <ReferenceArea 
                {...({
                  x1: data[data.length - 7].date, 
                  x2: data[data.length - 1].date, 
                  fill: getRiskColor(),
                  fillOpacity: 0.1
                } as any)}
              />
            )}

            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#00f2fe" 
              strokeWidth={2} 
              dot={{ fill: '#00f2fe', r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`w-1 h-3 rounded-full ${i > 4 ? 'bg-accent/20' : 'bg-accent'}`} />
          ))}
        </div>
        <button className="text-[10px] font-bold text-accent uppercase tracking-wider hover:opacity-80 transition-all">
          Explain Pattern ↗
        </button>
      </div>
    </div>
  );
}
