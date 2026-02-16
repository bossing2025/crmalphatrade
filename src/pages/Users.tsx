import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { EditUserDialog } from "@/components/users/EditUserDialog";
import { UserPermissionsDialog } from "@/components/users/UserPermissionsDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users as UsersIcon, Shield, Edit, MoreHorizontal, Key, LogIn, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  super_admin: "bg-red-500/10 text-red-500 border-red-500/20",
  manager: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  agent: "bg-green-500/10 text-green-500 border-green-500/20",
  affiliate: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

interface UserToEdit {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  roles?: string[];
}

export default function Users() {
  const { users, isLoading } = useUsers();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<UserToEdit | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<UserToEdit | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleEditUser = (userToEdit: typeof users extends (infer T)[] | undefined ? T : never) => {
    setEditingUser({
      id: userToEdit.id,
      username: userToEdit.username,
      email: userToEdit.email,
      full_name: userToEdit.full_name,
      roles: userToEdit.roles,
    });
    setEditDialogOpen(true);
  };

  const handleManagePermissions = (userToEdit: UserToEdit) => {
    setPermissionsUser(userToEdit);
    setPermissionsDialogOpen(true);
  };

  const handleLoginAsUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast.info("You're already logged in as this user");
      return;
    }

    setImpersonatingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Use verifyOtp with token_hash to log in as the target user
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: "magiclink",
      });

      if (otpError) throw otpError;

      toast.success(`Logged in as ${data.email}`);
      // Reload to reflect new session
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to login as user");
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">
              Manage user accounts and permissions
            </p>
          </div>
          {isSuperAdmin && <CreateUserDialog />}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
              <Shield className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.roles.includes('super_admin')).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <Shield className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.roles.includes('manager')).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Agents</CardTitle>
              <Shield className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.roles.includes('agent')).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Created</TableHead>
                    {isSuperAdmin && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((tableUser) => (
                    <TableRow key={tableUser.id}>
                      <TableCell className="font-mono">
                        {tableUser.username || <span className="text-muted-foreground italic">Not set</span>}
                      </TableCell>
                      <TableCell>{tableUser.email}</TableCell>
                      <TableCell>{tableUser.full_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tableUser.roles.length > 0 ? (
                            tableUser.roles.map((role) => (
                              <Badge
                                key={role}
                                variant="outline"
                                className={roleColors[role] || ""}
                              >
                                {role.replace("_", " ")}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(tableUser.created_at), "MMM d, yyyy")}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(tableUser)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleManagePermissions(tableUser)}>
                                <Key className="h-4 w-4 mr-2" />
                                Permissions
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleLoginAsUser(tableUser.id)}
                                disabled={impersonatingId === tableUser.id}
                                className="text-blue-600"
                              >
                                {impersonatingId === tableUser.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <LogIn className="h-4 w-4 mr-2" />
                                )}
                                Login as User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EditUserDialog
        user={editingUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <UserPermissionsDialog
        user={permissionsUser}
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
      />
    </DashboardLayout>
  );
}
