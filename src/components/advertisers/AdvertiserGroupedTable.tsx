import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type Advertiser = Database['public']['Tables']['advertisers']['Row'];

interface AdvertiserType {
  value: string;
  label: string;
}

interface AdvertiserGroupedTableProps {
  advertisers: Advertiser[];
  advertiserTypes: AdvertiserType[];
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean) => void;
  onSelectAllInGroup: (ids: string[], selected: boolean) => void;
  onStatusChange: (id: string, isActive: boolean) => void;
  onEdit: (advertiser: Advertiser) => void;
  onDelete: (id: string) => void;
  onTestLead: (advertiser: Advertiser) => void;
  canManage: boolean;
  isSuperAdmin: boolean;
}

export function AdvertiserGroupedTable({
  advertisers,
  advertiserTypes,
  selectedIds,
  onSelectChange,
  onSelectAllInGroup,
  onStatusChange,
  onEdit,
  onDelete,
  onTestLead,
  canManage,
  isSuperAdmin,
}: AdvertiserGroupedTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["all"]));

  // Group advertisers by type
  const groupedAdvertisers = useMemo(() => {
    const groups: Record<string, Advertiser[]> = {};
    
    for (const adv of advertisers) {
      const type = adv.advertiser_type || "unknown";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(adv);
    }
    
    return groups;
  }, [advertisers]);

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const getTypeLabel = (type: string) => {
    return advertiserTypes.find(t => t.value === type)?.label || type;
  };

  const sortedTypes = Object.keys(groupedAdvertisers).sort((a, b) => {
    const aLabel = getTypeLabel(a);
    const bLabel = getTypeLabel(b);
    return aLabel.localeCompare(bLabel);
  });

  return (
    <div className="space-y-2">
      {sortedTypes.map((type) => {
        const typeAdvertisers = groupedAdvertisers[type];
        const isExpanded = expandedGroups.has(type);
        const selectedInGroup = typeAdvertisers.filter(a => selectedIds.has(a.id)).length;
        const allSelectedInGroup = selectedInGroup === typeAdvertisers.length;
        const activeCount = typeAdvertisers.filter(a => a.is_active).length;

        return (
          <Collapsible key={type} open={isExpanded} onOpenChange={() => toggleGroup(type)}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Checkbox
                    checked={allSelectedInGroup && typeAdvertisers.length > 0}
                    onCheckedChange={(checked) => {
                      onSelectAllInGroup(
                        typeAdvertisers.map(a => a.id),
                        !!checked
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="font-medium">{getTypeLabel(type)}</span>
                  <Badge variant="secondary">{typeAdvertisers.length}</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({activeCount} active)
                  </span>
                </div>
                {selectedInGroup > 0 && (
                  <Badge variant="outline">{selectedInGroup} selected</Badge>
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="border rounded-lg mt-1 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Daily Cap</TableHead>
                      <TableHead>Hourly Cap</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeAdvertisers.map((advertiser) => (
                      <TableRow key={advertiser.id} className={selectedIds.has(advertiser.id) ? "bg-muted/20" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(advertiser.id)}
                            onCheckedChange={(checked) => onSelectChange(advertiser.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {advertiser.name}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                          {advertiser.url || "-"}
                        </TableCell>
                        <TableCell>{advertiser.daily_cap || "-"}</TableCell>
                        <TableCell>{advertiser.hourly_cap || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={advertiser.is_active}
                              onCheckedChange={(checked) => {
                                if (canManage) {
                                  onStatusChange(advertiser.id, checked);
                                }
                              }}
                              disabled={!canManage}
                            />
                            <span className={`text-sm ${advertiser.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {advertiser.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(advertiser.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onTestLead(advertiser)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Send Test Lead
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onEdit(advertiser)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {isSuperAdmin && (
                                  <DropdownMenuItem 
                                    onClick={() => onDelete(advertiser.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
