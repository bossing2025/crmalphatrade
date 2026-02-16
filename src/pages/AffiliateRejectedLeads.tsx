import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, Search, XCircle, Loader2, X } from "lucide-react";
import { useAffiliateSubmissionFailures, useDeleteAffiliateSubmissionFailures } from "@/hooks/useAffiliateSubmissionFailures";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useCRMSettings } from "@/hooks/useCRMSettings";

// Keys to hide from affiliate view (internal config)
const HIDDEN_KEYS = ['addonData', 'ai', 'ci', 'gi', 'api_key', 'apiKey', 'password', 'username', 'box', 'advertiser_id', 'advertiser_name'];

// Sanitize payload to remove internal configuration data
const sanitizePayload = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (HIDDEN_KEYS.includes(key)) continue;
    // Also hide any key containing 'key' or 'secret' (case insensitive)
    if (/key|secret|token|password/i.test(key)) continue;
    sanitized[key] = typeof value === 'object' ? sanitizePayload(value) : value;
  }
  return sanitized;
};

// Safe JSON stringify helper
const safeStringify = (obj: unknown): string => {
  try {
    const sanitized = sanitizePayload(obj);
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return "Unable to display payload";
  }
};

export default function AffiliateRejectedLeads() {
  const { formatDate } = useCRMSettings();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [rejectionCodeFilter, setRejectionCodeFilter] = useState<string>("all");
  const [viewingPayload, setViewingPayload] = useState<Record<string, unknown> | null>(null);

  const filters = {
    affiliateId: affiliateFilter !== "all" ? affiliateFilter : undefined,
    rejectionCode: rejectionCodeFilter !== "all" ? rejectionCodeFilter : undefined,
    search: search || undefined,
  };

  const { data: failures = [], isLoading, error } = useAffiliateSubmissionFailures(filters);
  const { data: affiliates = [] } = useAffiliates();
  const deleteMutation = useDeleteAffiliateSubmissionFailures();

  // Get unique rejection codes for filter
  const rejectionCodes = [...new Set(failures.map((f) => f.rejection_code))].filter(Boolean);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(failures.map((f) => f.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await deleteMutation.mutateAsync(selectedIds);
    setSelectedIds([]);
  };

  const getAffiliateName = (affiliateId: string | null) => {
    if (!affiliateId) return "Unknown";
    const affiliate = affiliates.find((a) => a.id === affiliateId);
    return affiliate?.name || affiliateId.slice(0, 8);
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load data</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Affiliate Rejected Leads</h1>
            <p className="text-muted-foreground">
              Leads rejected during affiliate submission
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Rejection Log ({failures.length})</span>
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected ({selectedIds.length})
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, name, phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Affiliates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Affiliates</SelectItem>
                  {affiliates.map((aff) => (
                    <SelectItem key={aff.id} value={aff.id}>
                      {aff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rejectionCodeFilter} onValueChange={setRejectionCodeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Rejection Codes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rejection Codes</SelectItem>
                  {rejectionCodes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : failures.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rejected submissions found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            failures.length > 0 &&
                            selectedIds.length === failures.length
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Affiliate</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Rejection Reason</TableHead>
                      <TableHead className="w-[80px]">Payload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failures.map((failure) => (
                      <TableRow key={failure.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(failure.id)}
                            onCheckedChange={(checked) =>
                              handleSelectOne(failure.id, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(new Date(failure.created_at))}
                        </TableCell>
                        <TableCell>
                          {getAffiliateName(failure.affiliate_id)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {failure.email || "-"}
                        </TableCell>
                        <TableCell>
                          {[failure.firstname, failure.lastname]
                            .filter(Boolean)
                            .join(" ") || "-"}
                        </TableCell>
                        <TableCell>
                          {failure.country_code ? (
                            <Badge variant="outline">{failure.country_code}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="flex flex-col gap-1">
                            <Badge variant="destructive" className="w-fit">
                              {failure.rejection_code}
                            </Badge>
                            {failure.rejection_message && (
                              <span className="text-xs text-muted-foreground">
                                {failure.rejection_message}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {failure.raw_payload && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingPayload(failure.raw_payload)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Native Modal for viewing payload */}
      {viewingPayload && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setViewingPayload(null)}
        >
          <div 
            className="bg-background border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Raw Payload</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewingPayload(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {safeStringify(viewingPayload)}
            </pre>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
