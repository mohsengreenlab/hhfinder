import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Edit, UserCheck, UserX, Loader2 } from "lucide-react";
import LoadingLines from "@/components/LoadingLines";
import { apiRequest } from "@/lib/queryClient";

const createUserSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isAdmin: z.boolean().default(false)
});

const updateUserSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional()
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type UpdateUserForm = z.infer<typeof updateUserSchema>;

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"]
  });

  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      isAdmin: false
    }
  });

  const updateUserForm = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserSchema)
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowCreateUser(false);
      createUserForm.reset();
      setError("");
    },
    onError: (error: Error) => {
      setError(error.message);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: UpdateUserForm }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
      updateUserForm.reset();
      setError("");
    },
    onError: (error: Error) => {
      setError(error.message);
    }
  });

  const onCreateUser = (data: CreateUserForm) => {
    setError("");
    createUserMutation.mutate(data);
  };

  const onUpdateUser = (data: UpdateUserForm) => {
    if (!selectedUser) return;
    setError("");
    updateUserMutation.mutate({ userId: selectedUser.id, data });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage users and access
              </p>
            </div>
          </div>
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={createUserForm.handleSubmit(onCreateUser)} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="create-username">Username</Label>
                  <Input
                    id="create-username"
                    {...createUserForm.register("username")}
                    disabled={createUserMutation.isPending}
                  />
                  {createUserForm.formState.errors.username && (
                    <p className="text-sm text-red-600">
                      {createUserForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-password">Password</Label>
                  <Input
                    id="create-password"
                    type="password"
                    {...createUserForm.register("password")}
                    disabled={createUserMutation.isPending}
                  />
                  {createUserForm.formState.errors.password && (
                    <p className="text-sm text-red-600">
                      {createUserForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="create-isAdmin"
                    checked={createUserForm.watch("isAdmin")}
                    onCheckedChange={(checked) => createUserForm.setValue("isAdmin", checked)}
                    disabled={createUserMutation.isPending}
                  />
                  <Label htmlFor="create-isAdmin">Admin privileges</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateUser(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user accounts and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingLines count={5} />
            ) : users && users.length > 0 ? (
              <div className="space-y-4">
                {users.map((user: User) => (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{user.username}</h3>
                          <div className="flex gap-1">
                            {user.isAdmin && (
                              <Badge variant="default">Admin</Badge>
                            )}
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p>Created: {formatDate(user.createdAt)}</p>
                          <p>Last login: {formatDate(user.lastLoginAt)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            updateUserForm.reset({
                              username: user.username,
                              isActive: user.isActive
                            });
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={user.isActive ? "secondary" : "default"}
                          onClick={() => {
                            updateUserMutation.mutate({
                              userId: user.id,
                              data: { isActive: !user.isActive }
                            });
                          }}
                        >
                          {user.isActive ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No users found.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User: {selectedUser?.username}</DialogTitle>
            </DialogHeader>
            <form onSubmit={updateUserForm.handleSubmit(onUpdateUser)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="update-username">Username</Label>
                <Input
                  id="update-username"
                  {...updateUserForm.register("username")}
                  disabled={updateUserMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-password">New Password (leave blank to keep current)</Label>
                <Input
                  id="update-password"
                  type="password"
                  placeholder="Enter new password..."
                  {...updateUserForm.register("password")}
                  disabled={updateUserMutation.isPending}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="update-isActive"
                  checked={updateUserForm.watch("isActive")}
                  onCheckedChange={(checked) => updateUserForm.setValue("isActive", checked)}
                  disabled={updateUserMutation.isPending}
                />
                <Label htmlFor="update-isActive">Active user</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update User"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}