import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getCampaign, updateCampaign, addContactsToCampaign } from "@/lib/server/campaigns";
import { getContacts } from "@/lib/server/contacts";
import {
  enqueueEnrichment,
  enqueueDrafting,
  enqueueSending,
  getCampaignProgress,
} from "@/lib/queue/producers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Sparkles,
  PenLine,
  Send,
  Users,
  Plus,
  Play,
  Pause,
  CheckCircle2,
} from "lucide-react";
import type { CampaignContactStage } from "@/lib/db/schema";

const STAGE_ORDER: CampaignContactStage[] = [
  "new",
  "queued_enrich",
  "enriching",
  "enriched",
  "queued_draft",
  "drafting",
  "drafted",
  "approved",
  "queued_send",
  "sending",
  "sent",
  "replied",
  "bounced",
  "skipped",
];

const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-800",
  queued_enrich: "bg-orange-100 text-orange-800",
  enriching: "bg-yellow-100 text-yellow-800",
  enriched: "bg-blue-100 text-blue-800",
  queued_draft: "bg-orange-100 text-orange-800",
  drafting: "bg-yellow-100 text-yellow-800",
  drafted: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  queued_send: "bg-orange-100 text-orange-800",
  sending: "bg-yellow-100 text-yellow-800",
  sent: "bg-emerald-100 text-emerald-800",
  replied: "bg-green-200 text-green-900",
  bounced: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-500",
};

export const Route = createFileRoute("/campaigns/$id")({
  component: CampaignDetail,
  loader: async ({ params }) => {
    const campaign = await getCampaign({ data: { id: params.id } });
    const { contacts } = await getContacts({ data: {} });
    return { campaign, allContacts: contacts };
  },
});

function CampaignDetail() {
  const { campaign, allContacts } = Route.useLoaderData();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState("");

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    templatePrompt: string;
    status: "draft" | "active" | "paused" | "completed";
  }>({
    name: campaign?.name || "",
    description: campaign?.description || "",
    templatePrompt: campaign?.templatePrompt || "",
    status: (campaign?.status as "draft" | "active" | "paused" | "completed") || "draft",
  });

  if (!campaign) {
    return (
      <div className="p-6">
        <p>Campaign not found</p>
        <Button asChild className="mt-4">
          <Link to="/campaigns">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const contactsByStage = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = campaign.campaignContacts?.filter((cc) => cc.stage === stage) || [];
    return acc;
  }, {} as Record<string, typeof campaign.campaignContacts>);

  const newCount = contactsByStage.new?.length || 0;
  const enrichedCount = contactsByStage.enriched?.length || 0;
  const draftedCount = contactsByStage.drafted?.length || 0;
  const approvedCount = contactsByStage.approved?.length || 0;

  const existingContactIds = new Set(
    campaign.campaignContacts?.map((cc) => cc.contactId) || []
  );
  const availableContacts = allContacts.filter(
    (c) => !existingContactIds.has(c.id)
  );

  const handleSave = async () => {
    await updateCampaign({ data: { id: campaign.id, ...formData } });
    setIsEditing(false);
    navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
  };

  const handleAddContacts = async () => {
    if (selectedContacts.length === 0) return;
    await addContactsToCampaign({
      data: { campaignId: campaign.id, contactIds: selectedContacts },
    });
    setSelectedContacts([]);
    setShowAddContacts(false);
    navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
  };

  // Poll for progress when processing
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getCampaignProgress>> | null>(null);

  useEffect(() => {
    if (!isProcessing || !campaign?.id) return;

    const poll = async () => {
      try {
        const result = await getCampaignProgress({ data: { campaignId: campaign.id } });
        setProgress(result);

        // Stop polling if no more queued/processing items
        if (result.queued === 0 && result.processing === 0) {
          setIsProcessing(false);
          setProcessingAction("");
          navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
        }
      } catch (e) {
        console.error("Failed to poll progress:", e);
      }
    };

    poll(); // Initial poll
    const interval = setInterval(poll, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [isProcessing, campaign?.id, navigate]);

  const handleEnrichAll = async () => {
    setIsProcessing(true);
    setProcessingAction("Queuing enrichment jobs...");
    try {
      const result = await enqueueEnrichment({ data: { campaignId: campaign.id } });
      if (result.queued === 0) {
        alert("No contacts to enrich. Make sure contacts are in 'new' stage.");
        setIsProcessing(false);
        setProcessingAction("");
      } else {
        setProcessingAction(`Enriching ${result.queued} contacts...`);
      }
    } catch (error) {
      console.error("Enrichment failed:", error);
      alert(`Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsProcessing(false);
      setProcessingAction("");
    }
  };

  const handleDraftAll = async () => {
    setIsProcessing(true);
    setProcessingAction("Queuing drafting jobs...");
    try {
      const result = await enqueueDrafting({ data: { campaignId: campaign.id } });
      if (result.queued === 0) {
        alert("No contacts to draft. Make sure contacts are in 'enriched' stage.");
        setIsProcessing(false);
        setProcessingAction("");
      } else {
        setProcessingAction(`Drafting ${result.queued} emails...`);
      }
    } catch (error) {
      console.error("Drafting failed:", error);
      alert(`Drafting failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsProcessing(false);
      setProcessingAction("");
    }
  };

  const handleSendAll = async () => {
    setIsProcessing(true);
    setProcessingAction("Queuing emails for sending...");
    try {
      const result = await enqueueSending({ data: { campaignId: campaign.id } });
      if (result.queued === 0) {
        alert("No emails to send. Make sure emails are approved first.");
        setIsProcessing(false);
        setProcessingAction("");
      } else {
        setProcessingAction(`Sending ${result.queued} emails (~${result.estimatedMinutes} min)...`);
      }
    } catch (error) {
      console.error("Sending failed:", error);
      alert(`Sending failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsProcessing(false);
      setProcessingAction("");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {/* Campaign Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-2">
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="text-xl font-bold"
              />
            ) : (
              <CardTitle className="text-xl">{campaign.name}</CardTitle>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline">{campaign.product}</Badge>
              {isEditing ? (
                <Select
                  value={formData.status}
                  onValueChange={(value: "draft" | "active" | "paused" | "completed") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant={campaign.status === "active" ? "default" : "secondary"}
                >
                  {campaign.status}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        {(isEditing || campaign.description) && (
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Custom Prompt</Label>
                  <Textarea
                    value={formData.templatePrompt}
                    onChange={(e) =>
                      setFormData({ ...formData, templatePrompt: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Action Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setShowAddContacts(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contacts
            </Button>

            <div className="h-6 w-px bg-border" />

            <Button
              variant="outline"
              onClick={handleEnrichAll}
              disabled={newCount === 0 || isProcessing}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Enrich All ({newCount})
            </Button>

            <Button
              variant="outline"
              onClick={handleDraftAll}
              disabled={enrichedCount === 0 || isProcessing}
            >
              <PenLine className="mr-2 h-4 w-4" />
              Draft All ({enrichedCount})
            </Button>

            {draftedCount > 0 && (
              <Button variant="outline" asChild>
                <Link to="/review" search={{ campaignId: campaign.id }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Review Drafts ({draftedCount})
                </Link>
              </Button>
            )}

            <Button
              onClick={handleSendAll}
              disabled={approvedCount === 0 || isProcessing}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Approved ({approvedCount})
            </Button>

            {isProcessing && (
              <span className="text-sm text-muted-foreground ml-2">
                {processingAction}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGE_ORDER.filter((stage) => contactsByStage[stage]?.length > 0).map(
          (stage) => (
            <Card key={stage}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium capitalize">
                    {stage}
                  </CardTitle>
                  <Badge variant="secondary">
                    {contactsByStage[stage]?.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {contactsByStage[stage]?.map((cc) => (
                  <Link
                    key={cc.id}
                    to="/contacts/$id"
                    params={{ id: cc.contactId }}
                    className="block p-2 rounded border hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-sm">
                      {cc.contact.firstName} {cc.contact.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {cc.contact.email}
                    </p>
                    {cc.contact.company && (
                      <p className="text-xs text-muted-foreground">
                        {cc.contact.company.name}
                      </p>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Full Contact List */}
      {campaign.campaignContacts && campaign.campaignContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Contacts ({campaign.campaignContacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {campaign.campaignContacts.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center justify-between py-3"
                >
                  <Link
                    to="/contacts/$id"
                    params={{ id: cc.contactId }}
                    className="flex-1"
                  >
                    <p className="font-medium">
                      {cc.contact.firstName} {cc.contact.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cc.contact.email}
                      {cc.contact.company && ` • ${cc.contact.company.name}`}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge className={STAGE_COLORS[cc.stage]}>{cc.stage}</Badge>
                    {cc.stage === "drafted" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/review">Review</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Contacts Dialog */}
      <AlertDialog open={showAddContacts} onOpenChange={setShowAddContacts}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Add Contacts to Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Select contacts to add to this campaign
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {availableContacts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                All contacts are already in this campaign
              </p>
            ) : (
              availableContacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts([...selectedContacts, contact.id]);
                      } else {
                        setSelectedContacts(
                          selectedContacts.filter((id) => id !== contact.id)
                        );
                      }
                    }}
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {contact.email}
                      {contact.company && ` • ${contact.company.name}`}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddContacts}
              disabled={selectedContacts.length === 0}
            >
              Add {selectedContacts.length} Contact
              {selectedContacts.length !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
