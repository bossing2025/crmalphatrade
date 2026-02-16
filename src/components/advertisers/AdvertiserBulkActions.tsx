import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Power, Settings2 } from "lucide-react";

interface AdvertiserBulkActionsProps {
  selectedIds: Set<string>;
  onBulkStatusChange: (ids: string[], isActive: boolean) => void;
  onBulkCapUpdate: (ids: string[], dailyCap: number | null, hourlyCap: number | null) => void;
  isUpdating: boolean;
}

export function AdvertiserBulkActions({
  selectedIds,
  onBulkStatusChange,
  onBulkCapUpdate,
  isUpdating,
}: AdvertiserBulkActionsProps) {
  const [isCapDialogOpen, setIsCapDialogOpen] = useState(false);
  const [dailyCap, setDailyCap] = useState<string>("");
  const [hourlyCap, setHourlyCap] = useState<string>("");

  if (selectedIds.size === 0) return null;

  const selectedArray = Array.from(selectedIds);

  const handleCapUpdate = () => {
    onBulkCapUpdate(
      selectedArray,
      dailyCap ? parseInt(dailyCap) : null,
      hourlyCap ? parseInt(hourlyCap) : null
    );
    setIsCapDialogOpen(false);
    setDailyCap("");
    setHourlyCap("");
  };

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
        <span className="text-sm font-medium mr-2">
          Bulk Actions ({selectedIds.size} selected):
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBulkStatusChange(selectedArray, true)}
          disabled={isUpdating}
        >
          <Power className="h-4 w-4 mr-1 text-green-600" />
          Enable All
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBulkStatusChange(selectedArray, false)}
          disabled={isUpdating}
        >
          <Power className="h-4 w-4 mr-1 text-red-600" />
          Disable All
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCapDialogOpen(true)}
          disabled={isUpdating}
        >
          <Settings2 className="h-4 w-4 mr-1" />
          Update Caps
        </Button>
      </div>

      <Dialog open={isCapDialogOpen} onOpenChange={setIsCapDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bulk Update Caps</DialogTitle>
            <DialogDescription>
              Update caps for {selectedIds.size} selected advertisers. Leave empty to keep current values.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Daily Cap</Label>
              <Input
                type="number"
                placeholder="Enter new daily cap..."
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Cap</Label>
              <Input
                type="number"
                placeholder="Enter new hourly cap..."
                value={hourlyCap}
                onChange={(e) => setHourlyCap(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCapDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCapUpdate} disabled={isUpdating || (!dailyCap && !hourlyCap)}>
              Update Caps
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
