"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";
import { type ReportPayload } from "@/lib/types";

export default function AdminReportsPage() {
  const { data, loading, error } = useApi<ReportPayload>("/api/owner/reports");

  const totalRevenue = useMemo(
    () => (data?.salesHistory || []).reduce((acc, row) => acc + Number(row.revenue_cents), 0),
    [data]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold text-neutral-900">Reports</h1>
      <p className="text-neutral-600">Sales history, revenue charts, and staff performance.</p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-neutral-600">Loading reports...</p> : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Revenue History ({formatCurrency(totalRevenue)})</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart data={data.salesHistory} />
            </CardContent>
          </Card>

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
