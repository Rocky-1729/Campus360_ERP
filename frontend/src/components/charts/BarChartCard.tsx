import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BarChartCardProps {
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  id?: string;
}

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title,
  data,
  xKey,
  yKey,
  color = "#4F46E5", // Indigo-600
  height = 300,
  id,
}) => {
  return (
    <div
      className="w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-left"
      id={id}
    >
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-6">
        {title}
      </h3>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
              className="dark:stroke-slate-800"
            />
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
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "12px",
              }}
            />
            <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
