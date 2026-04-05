"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type ApiEnvelope, type Category } from "@/lib/types";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/categories", { cache: "no-store" });
    const payload = (await res.json()) as ApiEnvelope<Category[]>;
    if (res.ok && payload.success) setCategories(payload.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCategory() {
    setError("");
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug })
    });
    const payload = (await res.json()) as { success: boolean; error?: { message: string } };
    if (!res.ok || !payload.success) {
      setError(payload.error?.message || "Failed to create category");
      return;
    }
    setName("");
    setSlug("");
    await load();
  }

  async function removeCategory(id: number) {
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    await load();
  }

  async function renameCategory(id: number, currentName: string) {
    const nameNext = window.prompt("Update category name", currentName);
    if (!nameNext || nameNext.trim() === "") return;

    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameNext.trim() })
    });

    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold text-neutral-900">Category Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create Category</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {error && <div className="w-full rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" maxLength={100} />
          <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="max-w-xs" maxLength={100} />
          <Button onClick={createCategory} disabled={!name.trim() || !slug.trim()}>Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm">
              <div>
                <p className="font-medium text-neutral-900">{category.name}</p>
                <p className="text-neutral-500">{category.slug}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => renameCategory(category.id, category.name)}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => removeCategory(category.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
