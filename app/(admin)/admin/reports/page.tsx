"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";
import { type ReportPayload } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const COLORS = ["#18181b", "#404040", "#737373", "#a3a3a3", "#d4d4d4", "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"];

const STATUS_COLORS: Record<string, string> = {
  pending: "#fbbf24",
  confirmed: "#60a5fa",
  in_production: "#a78bfa",
  ready_to_ship: "#34d399",
  shipped: "#2563eb",
  delivered: "#16a34a",
  cancelled: "#ef4444",
  payment_failed: "#f97316",
};

export default function AdminReportsPage() {
  const { data, loading, error } = useApi<ReportPayload>("/api/admin/reports");

  const totalRevenue = useMemo(
    () => (data?.salesHistory || []).reduce((acc, row) => acc + Number(row.revenue_cents), 0),
    [data]
  );

  const totalOrders = useMemo(
    () => (data?.orderStatusBreakdown || []).reduce((acc, r) => acc + Number(r.count), 0),
    [data]
  );

  const avgOrderValue = useMemo(() => {
    if (!data?.monthlyTrends?.length) return 0;
    const total = data.monthlyTrends.reduce((s, r) => s + Number(r.revenue_cents), 0);
    const count = data.monthlyTrends.reduce((s, r) => s + Number(r.order_count), 0);
    return count > 0 ? Math.round(total / count) : 0;
  }, [data]);

  const statusChartData = useMemo(
    () =>
      (data?.orderStatusBreakdown || []).map((r) => ({
        name: r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        value: Number(r.count),
        fill: STATUS_COLORS[r.status] || "#737373",
      })),
    [data]
  );

  const categoryChartData = useMemo(
    () =>
      (data?.categoryRevenue || []).map((r) => ({
        name: r.category_name,
        revenue: Number(r.revenue_cents) / 100,
        qty: Number(r.total_quantity),
      })),
    [data]
  );

  const monthlyChartData = useMemo(
    () =>
      (data?.monthlyTrends || []).map((r) => ({
        month: r.month,
        revenue: Number(r.revenue_cents) / 100,
        orders: Number(r.order_count),
        avgOrder: Number(r.avg_order_cents) / 100,
      })),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-neutral-900">Advanced Reports</h1>
        <p className="text-neutral-600">Comprehensive analytics across revenue, orders, categories, and staff.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-neutral-600">Loading reports...</p> : null}

      {data ? (
        <>
          {/* ── KPI Row ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Total Revenue</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Total Orders</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Avg Order Value</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{formatCurrency(avgOrderValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Top Customers</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{data.topCustomers?.length ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Revenue History Chart ── */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue History ({formatCurrency(totalRevenue)})</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart data={data.salesHistory} />
            </CardContent>
          </Card>

          {/* ── Monthly Trends ── */}
          {monthlyChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "orders" ? [value, "Orders"] : [`₱${Number(value).toLocaleString()}`, name === "revenue" ? "Revenue" : "Avg Order"]
                        }
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#18181b" strokeWidth={2} dot={{ r: 3 }} name="Revenue (₱)" />
                      <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Order Status + Category Revenue ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                      <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="#18181b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Top Customers ── */}
          {data.topCustomers?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Customers</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr className="text-neutral-500">
                      <th className="px-2 py-3">#</th>
                      <th className="px-2 py-3">Customer</th>
                      <th className="px-2 py-3">Orders</th>
                      <th className="px-2 py-3 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((c, i) => (
                      <tr key={c.customer_id} className="border-t border-neutral-200">
                        <td className="px-2 py-3 text-neutral-400">{i + 1}</td>
                        <td className="px-2 py-3 font-medium text-neutral-900">{c.customer_name || "Guest"}</td>
                        <td className="px-2 py-3">{c.order_count}</td>
                        <td className="px-2 py-3 text-right font-semibold">{formatCurrency(Number(c.total_spent_cents))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* ── Staff Performance ── */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="px-2 py-3">Staff</th>
                    <th className="px-2 py-3">Total Assignments</th>
                    <th className="px-2 py-3">Completed</th>
                    <th className="px-2 py-3">Active</th>
                    <th className="px-2 py-3">Avg Completion (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.designerPerformance.map((row) => (
                    <tr key={row.id} className="border-t border-neutral-200">
                      <td className="px-2 py-3 font-medium text-neutral-900">{row.full_name}</td>
                      <td className="px-2 py-3">{row.total_assignments}</td>
                      <td className="px-2 py-3">{row.completed_assignments}</td>
                      <td className="px-2 py-3">{row.active_assignments}</td>
                      <td className="px-2 py-3">
                        {row.avg_completion_hours ? Number(row.avg_completion_hours).toFixed(1) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
