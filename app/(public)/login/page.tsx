import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginSelectorPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfbfb,#f1f3f5)] p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pt-16">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Access</p>
          <h1 className="text-4xl font-semibold text-neutral-900">Sign in as Owner or Designer</h1>
          <p className="text-sm text-neutral-600">Customer shopping and ordering are still available without login.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Owner Login</CardTitle>
              <p className="text-sm text-neutral-600">Manage dashboard, orders, products, categories, and designers.</p>
            </CardHeader>
            <CardContent>
              <Link href="/owner/login" className="block">
                <Button className="w-full">Continue as Owner</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Designer Login</CardTitle>
              <p className="text-sm text-neutral-600">View and manage the order production queue.</p>
            </CardHeader>
            <CardContent>
              <Link href="/designer/login" className="block">
                <Button variant="outline" className="w-full">
                  Continue as Designer
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
