import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  getGmailConnection,
  initiateGmailConnection,
  disconnectGmail,
} from "@/lib/server/gmail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, ExternalLink, RefreshCw, Unplug, AlertCircle, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
  loader: () => getGmailConnection({ data: {} }),
  validateSearch: (search: Record<string, unknown>) => ({
    success: search.success as string | undefined,
    error: search.error as string | undefined,
  }),
});

function Settings() {
  const gmailConnection = Route.useLoaderData();
  const navigate = useNavigate();
  const { success, error } = Route.useSearch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Handle OAuth callback notifications
  useEffect(() => {
    if (success === 'gmail_connected') {
      setNotification({ type: 'success', message: 'Gmail connected successfully!' });
      // Clear the query params
      navigate({ to: '/settings', replace: true });
    } else if (error) {
      setNotification({ type: 'error', message: decodeURIComponent(error) });
      navigate({ to: '/settings', replace: true });
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
      setIsConnecting(false);
    }
  };

  const handleRefresh = () => {
    navigate({ to: "/settings" });
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectGmail({ data: {} });
      setNotification({ type: 'success', message: 'Gmail disconnected' });
      navigate({ to: '/settings' });
    } catch (error) {
      console.error("Failed to disconnect Gmail:", error);
      setNotification({ type: 'error', message: 'Failed to disconnect Gmail' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your integrations</p>
      </div>

      {notification && (
        <div className={`flex items-center gap-2 p-3 rounded-md ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
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
              <CardTitle>Gmail Connection</CardTitle>
            </div>
            <Badge variant={gmailConnection.connected ? "default" : "secondary"}>
              {gmailConnection.connected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gmailConnection.connected ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>
                  Connected as{" "}
                  <span className="font-medium">
                    {gmailConnection.email || "Gmail Account"}
                  </span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your Gmail account is connected. You can send emails from campaigns
                and track replies.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Reconnect
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account to send emails from campaigns.
                This uses Google OAuth for secure authentication.
              </p>
              <Button onClick={handleConnectGmail} disabled={isConnecting}>
                <Mail className="mr-2 h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Gmail"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            These secrets must be set via <code className="bg-muted px-1 rounded">wrangler secret put</code>:
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
