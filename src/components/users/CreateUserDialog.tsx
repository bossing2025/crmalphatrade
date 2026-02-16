import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const AVAILABLE_ROLES = [
  { id: "super_admin", label: "Super Admin", description: "Full access to all features" },
  { id: "manager", label: "Manager", description: "Manage leads, affiliates, advertisers" },
  { id: "agent", label: "Agent", description: "Work with assigned leads" },
  { id: "affiliate", label: "Affiliate", description: "External partner access" },
] as const;

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    roles: [] as string[],
  });
  const queryClient = useQueryClient();

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter((r) => r !== roleId)
        : [...prev.roles, roleId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.roles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }

    setIsLoading(true);

    try {
      // Call edge function to create user (uses admin API, won't log us out)
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          username: formData.username,
          fullName: formData.fullName,
          roles: formData.roles,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setOpen(false);
      setFormData({
        username: "",
        email: "",
        password: "",
        fullName: "",
        roles: [],
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/*
          Use a plain <button> here (instead of our <Button>) to avoid rare ref-composition loops
          when Radix `asChild` composes refs through Slot.
        */}
        <button type="button" className={cn(buttonVariants())}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new worker with their credentials and assign roles.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="e.g. 1001"
                  value={formData.username}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-3">
              <Label>Roles *</Label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_ROLES.map((role) => (
                  <label
                    key={role.id}
                    htmlFor={role.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.roles.includes(role.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Checkbox
                      id={role.id}
                      checked={formData.roles.includes(role.id)}
                      onCheckedChange={() => handleRoleToggle(role.id)}
                    />
                    <div className="space-y-1">
                      <span className="text-sm font-medium">{role.label}</span>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
