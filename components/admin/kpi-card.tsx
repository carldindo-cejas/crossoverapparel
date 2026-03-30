import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KpiCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function KpiCard({ label, value, helper }: KpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-neutral-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-neutral-900">{value}</p>
        {helper ? <p className="mt-1 text-xs text-neutral-500">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
