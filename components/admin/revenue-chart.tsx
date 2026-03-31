"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

type RevenueChartProps = {
  data: Array<{
    date: string;
    orders: number;
    revenue_cents: number;
  }>;
};

function formatAxisValue(cents: number) {
  return (cents / 100).toFixed(2);
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={formatAxisValue} />
          <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
          <Bar dataKey="revenue_cents" fill="#111827" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
