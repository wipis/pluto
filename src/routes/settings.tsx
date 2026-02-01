import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { initiateGmailConnection } from "@/lib/server/gmail";
import {
  getGmailAccounts,
  deleteGmailAccount,
  updateAccountLabel,
} from "@/lib/server/gmail-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Check,
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
  loader: () => getGmailAccounts(),
  validateSearch: (search: Record<string, unknown>) => ({
    success: search.success as string | undefined,
    error: search.error as string | undefined,
  }),
});

function Settings() {
  const accounts = Route.useLoaderData();
  const navigate = useNavigate();
  const { success, error } = Route.useSearch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Handle OAuth callback notifications
  useEffect(() => {
    if (success === "gmail_connected") {
      setNotification({
        type: "success",
        message: "Gmail account connected successfully!",
      });
      // Clear the query params and refresh
      navigate({ to: "/settings", search: {}, replace: true });
    } else if (error) {
      setNotification({ type: "error", message: decodeURIComponent(error) });
      navigate({ to: "/settings", search: {}, replace: true });
    }
  }, [success, error, navigate]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      const redirectUrl = `${window.location.origin}/settings`;
      const result = await initiateGmailConnection({ data: { redirectUrl } });
      if (result.authUrl) {
        window.location.href = result.authUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Gmail connection:", error);
      setNotification({ type: "error", message: "Failed to connect Gmail" });
      setIsConnecting(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    setDeletingId(accountId);
    try {
      await deleteGmailAccount({ data: { accountId } });
      setNotification({ type: "success", message: "Gmail account removed" });
      navigate({ to: "/settings", search: {} });
    } catch (error) {
      console.error("Failed to delete Gmail account:", error);
      setNotification({
        type: "error",
        message: "Failed to remove Gmail account",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartEdit = (accountId: string, currentLabel: string | null) => {
    setEditingId(accountId);
    setEditLabel(currentLabel || "");
  };

  const handleSaveLabel = async (accountId: string) => {
    try {
      await updateAccountLabel({ data: { accountId, label: editLabel } });
      setNotification({ type: "success", message: "Label updated" });
      setEditingId(null);
      navigate({ to: "/settings", search: {} });
    } catch (error) {
      console.error("Failed to update label:", error);
      setNotification({ type: "error", message: "Failed to update label" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your integrations</p>
      </div>

      {notification && (
        <div
          className={`flex items-center gap-2 p-3 rounded-md ${
            notification.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5" />
              <CardTitle>Gmail Accounts</CardTitle>
            </div>
            <Badge variant={accounts.length > 0 ? "default" : "secondary"}>
              {accounts.length} Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-green-500" />
                    <div>
                      {editingId === account.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Label (e.g., Work Gmail)"
                            className="h-8 w-48"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveLabel(account.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">
                            {account.label || account.userEmail}
                          </span>
                          {account.label && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({account.userEmail})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {editingId !== account.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleStartEdit(account.id, account.label)
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(account.id)}
                        disabled={deletingId === account.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Gmail accounts connected. Connect an account to send emails
              from campaigns.
            </p>
          )}

          <Button
            onClick={handleConnectGmail}
            disabled={isConnecting}
            variant={accounts.length > 0 ? "outline" : "default"}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isConnecting
              ? "Connecting..."
              : accounts.length > 0
                ? "Connect Another Account"
                : "Connect Gmail"}
          </Button>

          {accounts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              You can select which account to send from when creating a
              campaign.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Required Environment Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            These secrets must be set via{" "}
            <code className="bg-muted px-1 rounded">wrangler secret put</code>:
          </p>
          <ul className="text-sm space-y-1 font-mono">
            <li>GMAIL_CLIENT_ID - Google OAuth client ID</li>
            <li>GMAIL_CLIENT_SECRET - Google OAuth client secret</li>
            <li>ANTHROPIC_API_KEY - For email drafting with Claude</li>
            <li>EXA_API_KEY - For contact enrichment</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
