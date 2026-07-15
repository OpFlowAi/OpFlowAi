"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

type Point = { day: number; projectedBalance: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="text-muted-2 mb-0.5">Day +{payload[0].payload.day}</div>
      <div className="font-semibold text-foreground">{formatCurrency(payload[0].value)}</div>
    </div>
  );
}

export function CashFlowChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="day"
          stroke="var(--muted-2)"
          tick={{ fill: "var(--muted-2)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tickFormatter={(d: number) => `+${d}d`}
          interval={4}
        />
        <YAxis
          stroke="var(--muted-2)"
          tick={{ fill: "var(--muted-2)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
        />
        <ReferenceLine y={0} stroke="var(--danger)" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="projectedBalance"
          stroke="var(--chart-sequential)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
