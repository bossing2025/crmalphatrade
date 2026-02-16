import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Send, TrendingUp } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Advertiser = Database['public']['Tables']['advertisers']['Row'];

interface AdvertiserCardGridProps {
  advertisers: Advertiser[];
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean) => void;
  onStatusChange: (id: string, isActive: boolean) => void;
  onEdit: (advertiser: Advertiser) => void;
  onDelete: (id: string) => void;
  onTestLead: (advertiser: Advertiser) => void;
  canManage: boolean;
  isSuperAdmin: boolean;
}

export function AdvertiserCardGrid({
  advertisers,
  selectedIds,
  onSelectChange,
  onStatusChange,
  onEdit,
  onDelete,
  onTestLead,
  canManage,
  isSuperAdmin,
}: AdvertiserCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {advertisers.map((advertiser) => (
        <Card 
          key={advertiser.id} 
          className={`relative transition-all hover:shadow-md ${
            selectedIds.has(advertiser.id) ? 'ring-2 ring-primary' : ''
          } ${!advertiser.is_active ? 'opacity-60' : ''}`}
        >
          <CardContent className="p-4">
            {/* Header with checkbox and menu */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.has(advertiser.id)}
                  onCheckedChange={(checked) => onSelectChange(advertiser.id, !!checked)}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate" title={advertiser.name}>
                    {advertiser.name}
                  </h3>
                </div>
              </div>
              
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
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
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Caps info */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xs text-muted-foreground">Daily Cap</p>
                <p className="font-semibold text-sm">{advertiser.daily_cap || '∞'}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xs text-muted-foreground">Hourly Cap</p>
                <p className="font-semibold text-sm">{advertiser.hourly_cap || '∞'}</p>
              </div>
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between pt-2 border-t">
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
                <span className={`text-sm font-medium ${advertiser.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {advertiser.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              
              {advertiser.is_active && (
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
