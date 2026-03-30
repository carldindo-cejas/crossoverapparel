"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/admin/kpi-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { useRealtime } from "@/hooks/use-realtime";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";
import { type DashboardSummary } from "@/lib/types";

export default function AdminDashboardPage() {
  const [refreshTick, setRefreshTick] = useState(0);
  const { data, loading, error } = useApi<DashboardSummary>(`/api/owner/dashboard?tick=${refreshTick}`);

  useRealtime({
    role: "owner",
    onEvent: (event) => {
      if (event.type === "dashboard.updated" || event.type === "order.status.updated") {
        setRefreshTick((current) => current + 1);
      }
    }
  });

  const bestSellers = useMemo(() => data?.bestSellingProducts || [], [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-neutral-900">Owner Dashboard</h1>
        <p className="mt-2 text-neutral-600">Sales intelligence and operations snapshot.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-neutral-600">Loading dashboard...</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Total Sales" value={formatCurrency(data.totalSalesCents)} />
            <KpiCard label="Total Orders" value={String(data.totalOrders)} />
            <KpiCard label="Pending" value={String(data.pendingOrders)} />
            <KpiCard label="On Process" value={String(data.inProcessOrders)} />
            <KpiCard label="Delivered" value={String(data.deliveredOrders)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <SalesChart data={data.salesByDate} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best-Selling Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bestSellers.slice(0, 8).map((item) => (
                  <div key={`${item.product_id}-${item.product_name}`} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">{item.product_name}</span>
                    <span className="font-medium text-neutral-900">{item.total_quantity}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
