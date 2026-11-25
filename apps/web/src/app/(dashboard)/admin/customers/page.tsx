"use client";

import * as React from "react";
import { Mail, MapPin, Phone, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminTablePageSkeleton } from "@/components/shared/page-skeletons";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useAdminCustomersQuery, useOrdersQuery } from "@/hooks/use-store-queries";
import type { CustomerRecord } from "@/types/store.types";
import { formatDateShort, formatETB } from "@/utils/format";

export default function AdminCustomersPage() {
  const { data: customers = [], isLoading: loadingCustomers } = useAdminCustomersQuery();
  const { data: orders = [], isLoading: loadingOrders } = useOrdersQuery();
  const [query, setQuery] = React.useState("");
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerRecord | null>(null);
  const isMounted = useIsMounted();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.subCity.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const customerOrders = React.useMemo(() => {
    if (!selectedCustomer) return [];
    return orders.filter(
      (o) =>
        o.customerId === selectedCustomer.id ||
        o.customerEmail.toLowerCase() === selectedCustomer.email.toLowerCase(),
    );
  }, [orders, selectedCustomer]);

  const columns: DataTableColumn<CustomerRecord>[] = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            src={c.avatarUrl}
            name={c.name}
            alt={c.name}
            className="size-9 text-xs"
            blankClassName="bg-primary-light text-primary"
          />
          <div>
            <p className="font-display text-sm font-bold text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location & Phone",
      render: (c) => (
        <div className="text-xs">
          <p className="font-semibold text-foreground">
            {c.subCity}, {c.city}
          </p>
          <p className="text-muted-foreground">{c.phone}</p>
        </div>
      ),
    },
    {
      key: "size",
      header: "EU Fit",
      align: "center",
      render: (c) => <Badge variant="soft">EU {c.preferredSize}</Badge>,
    },
    {
      key: "orders",
      header: "Orders",
      align: "center",
      render: (c) => <span className="font-bold text-foreground">{c.totalOrders}</span>,
    },
    {
      key: "spent",
      header: "Lifetime Value",
      align: "right",
      render: (c) => (
        <span className="font-display font-extrabold text-primary">
          {formatETB(c.totalSpentETB)}
        </span>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      align: "center",
      render: (c) => (
        <Badge
          variant={
            c.tier === "VIP Runner" ? "cta" : c.tier === "Repeat Buyer" ? "default" : "outline"
          }
        >
          {c.tier}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Profile",
      align: "right",
      render: (c) => (
        <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCustomer(c)}>
          View CRM
        </Button>
      ),
    },
  ];

  if (!isMounted || loadingCustomers || loadingOrders) {
    return <AdminTablePageSkeleton title="Customers" hasCreateButton={false} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Customer Management (CRM)
          </h1>
          <p className="text-xs text-muted-foreground">
            Track repeat Addis Ababa shoppers, saved EU shoe sizes, and VIP spending tiers.
          </p>
        </div>
        <Badge variant="soft">
          <Users className="size-3.5" /> {customers.length} Active Customers
        </Badge>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer name, email, phone, or sub-city..."
            className="pl-10"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(c) => c.id}
        emptyMessage="No customers matched your search."
        isLoading={!isMounted}
      />

      <ModalDialog
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name ?? ""}
        description={
          selectedCustomer
            ? `Member since ${formatDateShort(selectedCustomer.joinedAt)} • Preferred Fit EU ${selectedCustomer.preferredSize}`
            : ""
        }
      >
        {selectedCustomer ? (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-low p-4 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary" />
                <span className="truncate">{selectedCustomer.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-primary" />
                <span>{selectedCustomer.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <span>
                  {selectedCustomer.subCity}, {selectedCustomer.city}
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-display text-sm font-bold text-foreground">
                Recent Orders ({customerOrders.length})
              </h4>
              {customerOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders in current session log.</p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border p-3">
                  {customerOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <span className="font-mono font-bold text-primary">#{o.id}</span>
                        <span className="ml-2 text-muted-foreground">
                          {formatDateShort(o.createdAt)}
                        </span>
                      </div>
                      <span className="font-display font-bold text-foreground">
                        {formatETB(o.totalETB)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}

