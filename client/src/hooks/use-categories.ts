import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: string;
  createdAt: string;
}

export function useCategories() {
  const { data: categories = [], isLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60000,
  });

  const categoryNames = categories.map(c => c.name);

  return { categories, categoryNames, isLoading };
}
