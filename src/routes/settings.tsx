import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { initiateGmailConnection } from "@/lib/server/gmail";
import {
  getGmailAccounts,
  deleteGmailAccount,
  updateAccountLabel,
} from "@/lib/server/gmail-auth";
import {
  createInvite,
  listInvites,
  revokeInvite,
  listUsers,
  removeUser,
} from "@/lib/server/invites";
import { getSession } from "@/lib/server/auth";
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
  Users,
  Copy,
  Link as LinkIcon,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
  loader: async () => {
    const [gmailAccounts, session] = await Promise.all([
      getGmailAccounts(),
      getSession(),
    ]);
    const isAdmin = session?.user?.role === "admin";
    const [invitesList, usersList] = isAdmin
      ? await Promise.all([listInvites(), listUsers()])
      : [[], []];
    return { gmailAccounts, isAdmin, invites: invitesList, users: usersList };
  },
  validateSearch: (search: Record<string, unknown>) => ({
    success: search.success as string | undefined,
    error: search.error as string | undefined,
  }),
});

function Settings() {
  const { gmailAccounts: accounts, isAdmin, invites, users } =
    Route.useLoaderData();
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

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Handle OAuth callback notifications
  useEffect(() => {
    if (success === "gmail_connected") {
      setNotification({
        type: "success",
        message: "Gmail account connected successfully!",
      });
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

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteLink(null);
    try {
      const result = await createInvite({ data: { email: inviteEmail } });
      const link = `${window.location.origin}/signup?token=${result.token}`;
      setInviteLink(link);
      setInviteEmail("");
      setNotification({ type: "success", message: "Invite created" });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to create invite",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setNotification({ type: "success", message: "Link copied to clipboard" });
    }
  };

  const handleRevokeInvite = async (id: string) => {
    try {
      await revokeInvite({ data: { id } });
      setNotification({ type: "success", message: "Invite revoked" });
      navigate({ to: "/settings", search: {} });
    } catch (err) {
      setNotification({ type: "error", message: "Failed to revoke invite" });
    }
  };

  const handleRemoveUser = async (id: string) => {
    setRemovingId(id);
    try {
      await removeUser({ data: { id } });
      setNotification({ type: "success", message: "User removed" });
      navigate({ to: "/settings", search: {} });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to remove user",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const pendingInvites = invites.filter((i) => i.status === "pending" && new Date() < i.expiresAt);

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

      {/* Team Management - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5" />
              <CardTitle>Team</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invite Form */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Invite a team member</h3>
              <form onSubmit={handleCreateInvite} className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="coworker@example.com"
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={isInviting}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isInviting ? "Inviting..." : "Invite"}
                </Button>
              </form>

              {inviteLink && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <code className="text-xs flex-1 truncate">{inviteLink}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Pending invites</h3>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <span className="text-sm font-medium">
                          {invite.email}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          expires{" "}
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            {users.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Members</h3>
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-sm font-medium">
                            {user.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {user.email}
                          </span>
                        </div>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                      </div>
                      {user.role !== "admin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={removingId === user.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
