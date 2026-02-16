import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const AVAILABLE_ROLES = [
  { id: "super_admin", label: "Super Admin", description: "Full access to all features" },
  { id: "manager", label: "Manager", description: "Manage leads, affiliates, advertisers" },
  { id: "agent", label: "Agent", description: "Work with assigned leads" },
  { id: "affiliate", label: "Affiliate", description: "External partner access" },
] as const;

interface UserData {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  roles?: string[];
}

interface EditUserDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Inner form component that only renders when we have a user
function EditUserForm({ 
  user, 
  onClose 
}: { 
  user: UserData; 
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState(user.username || "");
  const [fullName, setFullName] = useState(user.full_name || "");
  const [roles, setRoles] = useState<string[]>(user.roles || []);
  const queryClient = useQueryClient();

  const handleRoleToggle = (roleId: string) => {
    setRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (roles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }

    setIsLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username: username || null,
          full_name: fullName || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update roles atomically (prevents users from being left with zero roles)
      const { error: rolesError } = await supabase.rpc("set_user_roles", {
        _target_user_id: user.id,
        _roles: roles as any,
      });

      if (rolesError) throw rolesError;

      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              placeholder="e.g. 1001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-fullName">Full Name</Label>
            <Input
              id="edit-fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={user.email || ""}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-3">
          <Label>Roles *</Label>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_ROLES.map((role) => (
              <label
                key={role.id}
                htmlFor={`edit-${role.id}`}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  roles.includes(role.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Checkbox
                  id={`edit-${role.id}`}
                  checked={roles.includes(role.id)}
                  onCheckedChange={() => handleRoleToggle(role.id)}
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">
                    {role.label}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {role.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details and roles.
          </DialogDescription>
        </DialogHeader>
        {user && (
          <EditUserForm 
            key={user.id} 
            user={user} 
            onClose={() => onOpenChange(false)} 
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
