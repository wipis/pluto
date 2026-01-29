import { createFileRoute, Link } from "@tanstack/react-router";
import { getDashboardStats } from "@/lib/server/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  Megaphone,
  FileCheck,
  Send,
  MessageSquare,
  ArrowRight,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: () => getDashboardStats(),
});

function Dashboard() {
  const stats = Route.useLoaderData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your outreach campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/contacts/import">Import Contacts</Link>
          </Button>
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value={stats.totalContacts}
          icon={Users}
          href="/contacts"
        />
        <StatCard
          title="Companies"
          value={stats.totalCompanies}
          icon={Building2}
          href="/companies"
        />
        <StatCard
          title="Active Campaigns"
          value={stats.activeCampaigns}
          icon={Megaphone}
          href="/campaigns"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingReview}
          icon={FileCheck}
          href="/review"
          highlight={stats.pendingReview > 0}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span>Emails Sent</span>
              </div>
              <span className="font-semibold">{stats.sentThisWeek}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Replies Received</span>
              </div>
              <span className="font-semibold">{stats.repliedThisWeek}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.pipelineStats).map(([stage, count]) => (
                <Badge key={stage} variant="secondary">
                  {stage}: {count as number}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      {stats.recentCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Campaigns</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/campaigns">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  to="/campaigns/$id"
                  params={{ id: campaign.id }}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <Badge variant="outline" className="mt-1">
                      {campaign.product}
                    </Badge>
                  </div>
                  <Badge
                    variant={
                      campaign.status === "active" ? "default" : "secondary"
                    }
                  >
                    {campaign.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {stats.recentActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivities.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <Badge variant="outline" className="text-xs">
                    {activity.type.replace(/_/g, " ")}
                  </Badge>
                  {activity.contact && (
                    <span>
                      {activity.contact.firstName} {activity.contact.lastName}
                    </span>
                  )}
                  {activity.campaign && (
                    <span className="text-muted-foreground">
                      in {activity.campaign.name}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-auto">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  highlight = false,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link to={href}>
      <Card
        className={`hover:bg-muted/50 transition-colors cursor-pointer ${
          highlight ? "border-primary" : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
