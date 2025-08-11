import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

export function useAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  const queryClient = useQueryClient();

  // Check if user is authenticated
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });
      
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      setIsInitialized(true);
    }
  });

  // Initialize auth state
  useEffect(() => {
    if (!isLoading) {
      setIsInitialized(true);
    }
  }, [isLoading]);

  const isAuthenticated = !!user && !error;

  const logout = () => {
    logoutMutation.mutate();
  };

  const setUser = (newUser: User) => {
    queryClient.setQueryData(["/api/auth/me"], newUser);
  };

  return {
    user,
    isAuthenticated,
    isLoading: !isInitialized,
    logout,
    setUser
  };
}