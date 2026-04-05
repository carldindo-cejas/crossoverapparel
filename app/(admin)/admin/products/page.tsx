"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { type ApiEnvelope, type Category, type Product } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

// Auto-price mapping: category name → centavos
function categoryPriceCents(categoryName: string): number | null {
  const lower = categoryName.toLowerCase();
  if (lower.includes("jersey") || lower.includes("sando")) return 34900;
  if (lower.includes("tshirt") || lower.includes("t-shirt")) return 39900;
  if (lower.includes("polo")) return 44900;
  if (lower.includes("warmer")) return 54900;
  return null;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createImageRef = useRef<HTMLInputElement>(null);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    sku: "",
    name: "",
    slug: "",
    description: "",
    basePriceCents: "0",
    categoryId: "",
    status: "active" as string,
    isBanner: false
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    basePriceCents: "0",
    categoryId: "",
    status: "active" as string,
    isBanner: false
  });

  async function load() {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/admin/categories", { cache: "no-store" })
    ]);

    const p = (await productsRes.json()) as ApiEnvelope<Product[]>;
    const c = (await categoriesRes.json()) as ApiEnvelope<Category[]>;

    if (productsRes.ok && p.success) setProducts(p.data);
    if (categoriesRes.ok && c.success) setCategories(c.data);
  }

  useEffect(() => {
    load();
  }, []);

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function createProduct() {
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          slug: form.slug || autoSlug(form.name),
          description: form.description,
          basePriceCents: Number(form.basePriceCents),
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
          status: form.status,
          currency: "PHP",
          isBanner: form.isBanner
        })
      });

      const payload = (await res.json()) as ApiEnvelope<{ id: number }>;

      if (!res.ok || !payload.success) {
        setCreateError((payload as { success: false; error?: { message?: string } }).error?.message || "Failed to create product");
        return;
      }

      // Upload image if selected
      if (payload.success && createImage && payload.data.id) {
        const fd = new FormData();
        fd.append("file", createImage);
        await fetch(`/api/admin/products/${payload.data.id}/image`, {
          method: "POST",
          body: fd
        });
      }

      setForm({ sku: "", name: "", slug: "", description: "", basePriceCents: "0", categoryId: "", status: "active", isBanner: false });
      setCreateImage(null);
      if (createImageRef.current) createImageRef.current.value = "";
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(product: Product) {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description || "",
      basePriceCents: String(product.base_price_cents),
      categoryId: product.category_id ? String(product.category_id) : "",
      status: product.status,
      isBanner: (product as Product & { is_banner?: number }).is_banner === 1
    });
  }

  async function saveEdit() {
    if (!editingProduct) return;
    await fetch(`/api/admin/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description,
        basePriceCents: Number(editForm.basePriceCents),
        categoryId: editForm.categoryId ? Number(editForm.categoryId) : null,
        status: editForm.status,
        isBanner: editForm.isBanner
      })
    });
    setEditingProduct(null);
    await load();
  }

  function triggerImageUpload(productId: number) {
    setUploadingId(productId);
    fileInputRef.current?.click();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File must be under 2MB");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/admin/products/${uploadingId}/image`, { method: "POST", body: fd });

    setUploadingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold text-neutral-900">Product Management</h1>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Create Product */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {createError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{createError}</div>}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">SKU</label>
              <Input placeholder="e.g. JRS-001" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Product Name</label>
              <Input placeholder="e.g. Classic Jersey" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value, slug: autoSlug(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Price (centavos)</label>
              <Input type="number" placeholder="e.g. 2500" value={form.basePriceCents} onChange={(e) => setForm((p) => ({ ...p, basePriceCents: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Category</label>
              <select className="h-10 w-full rounded-xl border border-neutral-300 px-3" value={form.categoryId} onChange={(e) => {
                const catId = e.target.value;
                const cat = categories.find((c) => String(c.id) === catId);
                const autoPrice = cat ? categoryPriceCents(cat.name) : null;
                setForm((p) => ({ ...p, categoryId: catId, ...(autoPrice !== null ? { basePriceCents: String(autoPrice) } : {}) }));
              }}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Status</label>
              <select className="h-10 w-full rounded-xl border border-neutral-300 px-3" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active (visible on site)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Product Photo</label>
              <input ref={createImageRef} type="file" accept="image/*" className="h-10 w-full rounded-xl border border-neutral-300 px-3 pt-1.5 text-sm" onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-500">Description</label>
            <Textarea placeholder="Product description..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isBanner} onChange={(e) => setForm((p) => ({ ...p, isBanner: e.target.checked }))} className="h-4 w-4 rounded border-neutral-300" />
              Feature as Landing Page Banner
            </label>
          </div>
          <Button onClick={createProduct} disabled={creating || !form.sku || !form.name}>
            {creating ? "Creating..." : "Create Product"}
          </Button>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingProduct && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle>Edit: {editingProduct.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Name</label>
                <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Price (centavos)</label>
                <Input type="number" value={editForm.basePriceCents} onChange={(e) => setEditForm((p) => ({ ...p, basePriceCents: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Category</label>
                <select className="h-10 w-full rounded-xl border border-neutral-300 px-3" value={editForm.categoryId} onChange={(e) => {
                  const catId = e.target.value;
                  const cat = categories.find((c) => String(c.id) === catId);
                  const autoPrice = cat ? categoryPriceCents(cat.name) : null;
                  setEditForm((p) => ({ ...p, categoryId: catId, ...(autoPrice !== null ? { basePriceCents: String(autoPrice) } : {}) }));
                }}>
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Description</label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <select className="h-10 rounded-xl border border-neutral-300 px-3" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isBanner} onChange={(e) => setEditForm((p) => ({ ...p, isBanner: e.target.checked }))} className="h-4 w-4 rounded border-neutral-300" />
                Landing Page Banner
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit}>Save Changes</Button>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-neutral-500">
                <th className="px-2 py-3">Image</th>
                <th className="px-2 py-3">Name</th>
                <th className="px-2 py-3">SKU</th>
                <th className="px-2 py-3">Category</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Price</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className={`border-t border-neutral-200 ${(product as Product & { is_banner?: number }).is_banner === 1 ? "bg-amber-50" : ""}`}>
                  <td className="px-2 py-3">
                    {product.image_url ? (
                      <img src={`/api/products/images/${product.image_url}`} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 text-lg text-neutral-300">📷</div>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-medium text-neutral-900">{product.name}</div>
                    {(product as Product & { is_banner?: number }).is_banner === 1 && (
                      <Badge className="mt-1 bg-amber-100 text-amber-800">Banner</Badge>
                    )}
                  </td>
                  <td className="px-2 py-3 text-neutral-600">{product.sku}</td>
                  <td className="px-2 py-3 text-neutral-600">{product.category_name || "—"}</td>
                  <td className="px-2 py-3">
                    <Badge className={product.status === "active" ? "bg-green-100 text-green-800" : product.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-neutral-100 text-neutral-600"}>
                      {product.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 font-medium">{formatCurrency(product.base_price_cents)}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(product)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => triggerImageUpload(product.id)}>
                        {uploadingId === product.id ? "..." : "Photo"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => deleteProduct(product.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-8 text-center text-neutral-500">No products yet. Create one above.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
