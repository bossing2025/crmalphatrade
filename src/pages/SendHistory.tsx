import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { Calendar } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useGlobalSentLeads, getCooldownStatus } from "@/hooks/useGlobalSentLeads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TablePagination } from "@/components/ui/table-pagination";
import { format } from "date-fns";

export default function SendHistory() {
  const { defaultPageSize, getStartOfMonth, getEndOfMonth, getNow } = useCRMSettings();

  const [emailSearch, setEmailSearch] = useState("");
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pageSizeOptions = [5, 10, 15, 25, 50, 100];

  // Fetch advertisers for filter dropdown
  const { data: advertisers = [] } = useQuery({
    queryKey: ["advertisers-for-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("advertisers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const offset = (currentPage - 1) * pageSize;

  const { data: sentLeadsData = { leads: [], total: 0 }, isLoading } = useGlobalSentLeads({
    email: emailSearch,
    advertiser_id: advertiserFilter !== "all" ? advertiserFilter : undefined,
    fromDate,
    toDate,
    limit: pageSize,
    offset,
  });

  const totalPages = Math.ceil(sentLeadsData.total / pageSize);

  const getCooldownBadge = (sentAt: string) => {
    const status = getCooldownStatus(sentAt);

    if (status.status === "available") {
      return <Badge variant="default">Available</Badge>;
    }

    if (status.status === "24h-protection") {
      return (
        <Badge variant="secondary">
          24h Protection ({status.hoursRemaining}h)
        </Badge>
      );
    }

    return (
      <Badge variant="outline">
        5d Cooldown ({status.daysRemaining}d)
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Send History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all leads sent via injections with global protection rules
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    placeholder="Search by email..."
                    value={emailSearch}
                    onChange={(e) => {
                      setEmailSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Advertiser</label>
                  <Select value={advertiserFilter} onValueChange={(val) => {
                    setAdvertiserFilter(val);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Advertisers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Advertisers</SelectItem>
                      {advertisers.map((adv) => (
                        <SelectItem key={adv.id} value={adv.id}>
                          {adv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <input
                    type="date"
                    value={format(fromDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      setFromDate(new Date(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <input
                    type="date"
                    value={format(toDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      setToDate(new Date(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Sent Leads ({sentLeadsData.total})</CardTitle>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={pageSizeOptions}
                totalItems={sentLeadsData.total}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Country Code</TableHead>
                    <TableHead>Cooldown Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : sentLeadsData.leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sentLeadsData.leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-mono text-sm">{lead.email}</TableCell>
                        <TableCell className="font-medium">
                          {lead.advertisers?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(lead.sent_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm">{lead.country_code || "—"}</TableCell>
                        <TableCell>{getCooldownBadge(lead.sent_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
