"use client";

import { Activity, AlertCircle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHealthStatus } from "@/hooks/use-health-status";
import { clientEnv } from "@/lib/env";
import { formatUptime } from "@/utils/format";

export function ApiStatusCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useHealthStatus();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" aria-hidden="true" />
            Backend API Connectivity
          </CardTitle>
          <CardDescription>Endpoint: {clientEnv.apiUrl}/health</CardDescription>
        </div>

        {isLoading ? (
          <Badge variant="secondary">Checking...</Badge>
        ) : isError ? (
          <Badge variant="destructive">Unreachable</Badge>
        ) : data?.status === "ok" ? (
          <Badge variant="default">Healthy</Badge>
        ) : (
          <Badge variant="secondary">Degraded</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Contacting AddisGebeya API...</p>
        ) : isError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error instanceof Error ? error.message : "Unable to reach the backend API."}</p>
          </div>
        ) : data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="mt-1 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                {data.service} ({data.version})
              </p>
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Database</p>
              <p className="mt-1 flex items-center gap-1.5 font-medium capitalize">
                <Database className="size-4 text-muted-foreground" aria-hidden="true" />
                {data.database.status.replace("_", " ")}
                {data.database.latencyMs !== undefined ? ` (${data.database.latencyMs}ms)` : ""}
              </p>
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Environment</p>
              <p className="mt-1 font-medium capitalize">{data.environment}</p>
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="mt-1 font-medium">{formatUptime(data.uptimeSeconds)}</p>
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between border-t pt-4">
        <span className="text-xs text-muted-foreground">
          {data ? `Last checked: ${new Date(data.timestamp).toLocaleTimeString()}` : "Ready"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}
