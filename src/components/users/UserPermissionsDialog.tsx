import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  useUserPermissions,
  useUpdateUserPermissions,
  AVAILABLE_PERMISSIONS,
  UserPermission,
} from "@/hooks/useUserPermissions";

interface UserPermissionsDialogProps {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserPermissionsDialog({ user, open, onOpenChange }: UserPermissionsDialogProps) {
  const { permissions, isLoading } = useUserPermissions(user?.id);
  const updatePermission = useUpdateUserPermissions();
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  const handleTogglePermission = async (permissionId: UserPermission) => {
    if (!user) return;
    
    const hasPermission = permissions.includes(permissionId);
    const action = hasPermission ? 'remove' : 'add';
    
    setPendingChanges(prev => new Set(prev).add(permissionId));
    
    await updatePermission.mutateAsync({
      userId: user.id,
      permission: permissionId,
      action,
    });
    
    setPendingChanges(prev => {
      const next = new Set(prev);
      next.delete(permissionId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Permissions</DialogTitle>
          <DialogDescription>
            Configure what {user?.full_name || user?.email || "this user"} can access
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {AVAILABLE_PERMISSIONS.map((perm) => {
              const hasPermission = permissions.includes(perm.id);
              const isPending = pendingChanges.has(perm.id);
              
              return (
                <label
                  key={perm.id}
                  htmlFor={perm.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    hasPermission
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  } ${isPending ? "opacity-50" : ""}`}
                >
                  <Checkbox
                    id={perm.id}
                    checked={hasPermission}
                    disabled={isPending}
                    onCheckedChange={() => !isPending && handleTogglePermission(perm.id)}
                  />
                  <div className="space-y-1 flex-1">
                    <span className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      {perm.label}
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {perm.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
