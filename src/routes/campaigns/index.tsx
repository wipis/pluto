import { createFileRoute, Link } from "@tanstack/react-router";
import { getCampaigns } from "@/lib/server/campaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone, Users, Send, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/campaigns/")({
  component: CampaignList,
  loader: () => getCampaigns({}),
});

function CampaignList() {
  const campaigns = Route.useLoaderData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">{campaigns.length} campaigns</p>
        </div>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <Button asChild>
              <Link to="/campaigns/new">Create your first campaign</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to="/campaigns/$id"
              params={{ id: campaign.id }}
            >
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge
                      variant={
                        campaign.status === "active" ? "default" : "secondary"
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <Badge variant="outline">{campaign.product}</Badge>
                </CardHeader>
                <CardContent>
                  {campaign.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {campaign.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{campaign.counts.total} contacts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <span>{campaign.counts.sent} sent</span>
                    </div>
                    {campaign.counts.drafted > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {campaign.counts.drafted} drafts
                        </Badge>
                      </div>
                    )}
                    {campaign.counts.replied > 0 && (
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-green-500" />
                        <span className="text-green-600">
                          {campaign.counts.replied} replies
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
