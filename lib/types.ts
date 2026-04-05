export type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: number;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  base_price_cents: number;
  currency: string;
  status: "draft" | "active" | "archived";
  category_id: number | null;
  category_name?: string | null;
  image_url?: string | null;
  rating?: number;
  is_banner?: number;
  created_at?: string;
};

export type OrderFile = {
  id: number;
  r2_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type OrderItem = {
  id: number;
  product_id: number | null;
  variant_id: number | null;
  product_name_snapshot: string;
  variant_title_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type OrderCustomization = {
  id: number;
  order_item_id: number;
  customization_type: string;
  field_name: string;
  field_value: string;
  additional_cost_cents: number;
};

export type OrderStatusLog = {
  id: number;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  changed_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  placed_at: string;
  notes: string | null;
  payment_receipt_r2_key: string | null;
  customer_email: string;
  customer_name: string;
  items: OrderItem[];
  files: OrderFile[];
  customizations: OrderCustomization[];
  history: OrderStatusLog[];
};

export type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error?: {
        message?: string;
      };
    };

export type DashboardSummary = {
  totalSalesCents: number;
  totalOrders: number;
  pendingOrders: number;
  inProcessOrders: number;
  deliveredOrders: number;
  bestSellingProducts: Array<{
    product_id: number;
    product_name: string;
    total_quantity: number;
    total_revenue_cents: number;
  }>;
  salesByDate: Array<{
    sales_date: string;
    order_count: number;
    total_sales_cents: number;
  }>;
};

export type StaffRecord = {
  id: string;
  email: string;
  full_name: string;
  role: "designer";
  is_active: number;
  updated_at: string;
  last_presence_status: string | null;
  last_seen_at: string | null;
};

export type DesignerPerformance = {
  id: string;
  full_name: string;
  email: string;
  total_assignments: number;
  completed_assignments: number;
  active_assignments: number;
  avg_completion_hours: number | null;
};

export type ReportPayload = {
  salesHistory: Array<{
    date: string;
    orders: number;
    revenue_cents: number;
  }>;
  designerPerformance: DesignerPerformance[];
  orderStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  categoryRevenue: Array<{
    category_id: number;
    category_name: string;
    revenue_cents: number;
    total_quantity: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    order_count: number;
    revenue_cents: number;
    avg_order_cents: number;
  }>;
  topCustomers: Array<{
    customer_id: number;
    customer_name: string;
    order_count: number;
    total_spent_cents: number;
  }>;
};
