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

  async function load() {
    const res = await fetch("/api/owner/categories", { cache: "no-store" });
    const payload = (await res.json()) as ApiEnvelope<Category[]>;
    if (res.ok && payload.success) setCategories(payload.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCategory() {
    await fetch("/api/owner/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug })
    });
    setName("");
    setSlug("");
    await load();
  }

  async function removeCategory(id: number) {
    await fetch(`/api/owner/categories/${id}`, { method: "DELETE" });
    await load();
  }

  async function renameCategory(id: number, currentName: string) {
    const nameNext = window.prompt("Update category name", currentName);
    if (!nameNext || nameNext.trim() === "") return;

    await fetch(`/api/owner/categories/${id}`, {
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
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="max-w-xs" />
          <Button onClick={createCategory}>Create</Button>
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
