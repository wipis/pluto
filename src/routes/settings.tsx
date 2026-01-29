import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  getGmailConnection,
  initiateGmailConnection,
} from "@/lib/server/gmail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, ExternalLink, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
  loader: () => getGmailConnection(),
});

function Settings() {
  const gmailConnection = Route.useLoaderData();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your integrations</p>
      </div>

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
                Your Gmail account is connected via Composio. You can send emails
                from campaigns and track replies.
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
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account to send emails from campaigns. This
                uses Composio for secure OAuth authentication.
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
            <li>COMPOSIO_API_KEY - For Gmail integration</li>
            <li>ANTHROPIC_API_KEY - For email drafting with Claude</li>
            <li>EXA_API_KEY - For contact enrichment</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
