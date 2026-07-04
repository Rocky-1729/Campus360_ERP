import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LineOption {
  key: string;
  color: string;
  name: string;
}

interface LineChartCardProps {
  title: string;
  data: any[];
  xKey: string;
  lines: LineOption[];
  height?: number;
  id?: string;
}

export const LineChartCard: React.FC<LineChartCardProps> = ({
  title,
  data,
  xKey,
  lines,
  height = 300,
  id,
}) => {
  return (
    <div className="w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-left" id={id}>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-6">{title}</h3>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
            <XAxis
              dataKey={xKey}
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingBottom: '15px' }}
            />
            {lines.map((ln, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={ln.key}
                name={ln.name}
                stroke={ln.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
