"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

type SalesChartProps = {
  data: Array<{
    sales_date: string;
    order_count: number;
    total_sales_cents: number;
  }>;
};

function formatAxisValue(cents: number) {
  return (cents / 100).toFixed(2);
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="sales_date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatAxisValue} />
          <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
          <Line
            type="monotone"
            dataKey="total_sales_cents"
            stroke="#111827"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
