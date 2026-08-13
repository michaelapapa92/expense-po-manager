import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Bell, CheckCheck, X, MessageSquare, ThumbsUp, ThumbsDown, FileText, ShoppingCart, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRole } from "@/lib/roleContext";
import type { Notification } from "@shared/schema";

function getNotificationIcon(type: string) {
  switch (type) {
    case "approval":
    case "po_approval":
      return <ThumbsUp className="w-4 h-4 text-green-500" />;
    case "rejection":
    case "po_rejection":
      return <ThumbsDown className="w-4 h-4 text-red-500" />;
    case "comment":
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
    case "new_expense":
      return <FileText className="w-4 h-4 text-amber-500" />;
    case "po_more_info":
      return <Info className="w-4 h-4 text-orange-500" />;
    case "new_po":
    case "po_approval_needed":
      return <ShoppingCart className="w-4 h-4 text-[#E85D04]" />;
    case "approval_needed":
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

function timeAgo(date: string | Date | null): string {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isViewingAs, viewAsUser } = useRole();

  const notifUrl = isViewingAs && viewAsUser ? `/api/notifications?viewAsUserId=${viewAsUser.id}` : "/api/notifications";
  const countUrl = isViewingAs && viewAsUser ? `/api/notifications/unread-count?viewAsUserId=${viewAsUser.id}` : "/api/notifications/unread-count";

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: [countUrl],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: [notifUrl],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const params = isViewingAs && viewAsUser ? `?viewAsUserId=${viewAsUser.id}` : "";
      await apiRequest("PATCH", `/api/notifications/${id}/read${params}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [notifUrl] });
      queryClient.invalidateQueries({ queryKey: [countUrl] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const params = isViewingAs && viewAsUser ? `?viewAsUserId=${viewAsUser.id}` : "";
      await apiRequest("POST", `/api/notifications/mark-all-read${params}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [notifUrl] });
      queryClient.invalidateQueries({ queryKey: [countUrl] });
    },
  });

  const unreadCount = countData?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white" data-testid="badge-unread-count">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-96 max-h-[480px] p-0 flex flex-col"
        data-testid="panel-notifications"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500 hover:text-slate-700"
                onClick={() => markAllReadMutation.mutate()}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                  !notif.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
                onClick={() => {
                  if (!notif.isRead) markReadMutation.mutate(notif.id);
                }}
                data-testid={`notification-item-${notif.id}`}
              >
                <div className="mt-0.5 shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!notif.isRead ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                      {notif.title}
                    </p>
                    {!notif.isRead && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
