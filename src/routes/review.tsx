import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { handleError } from "@/lib/handle-error";
import { getReviewQueue, approveDraft, rejectDraft, updateDraft } from "@/lib/server/review";
import { regenerateDraft } from "@/lib/server/drafting";
import { sendEmail } from "@/lib/server/gmail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  X,
  RefreshCw,
  Send,
  ChevronLeft,
  ChevronRight,
  Building2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/review")({
  component: ReviewQueue,
  loader: () => getReviewQueue({}),
});

function ReviewQueue() {
  const drafts = Route.useLoaderData();
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResearch, setShowResearch] = useState(true);

  const selected = drafts[selectedIndex];

  useEffect(() => {
    if (selected) {
      setEditedSubject(selected.draftSubject || "");
      setEditedBody(selected.draftBody || "");
      setFeedback("");
    }
  }, [selectedIndex, selected?.id]);

  const handleApprove = async () => {
    if (!selected) return;
    setIsProcessing(true);
    try {
      await approveDraft({
        data: {
          campaignContactId: selected.id,
          finalSubject: editedSubject,
          finalBody: editedBody,
        },
      });
      moveToNext();
    } catch (error) {
      handleError(error, "Approve failed");
    }
    setIsProcessing(false);
  };

  const handleApproveAndSend = async () => {
    if (!selected) return;
    setIsProcessing(true);
    try {
      await approveDraft({
        data: {
          campaignContactId: selected.id,
          finalSubject: editedSubject,
          finalBody: editedBody,
        },
      });
      await sendEmail({ data: { campaignContactId: selected.id } });
      moveToNext();
    } catch (error) {
      handleError(error, "Send failed");
    }
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!selected) return;
    setIsProcessing(true);
    try {
      await rejectDraft({ data: { campaignContactId: selected.id } });
      moveToNext();
    } catch (error) {
      handleError(error, "Reject failed");
    }
    setIsProcessing(false);
  };

  const handleRegenerate = async () => {
    if (!selected) return;
    setIsProcessing(true);
    try {
      const result = await regenerateDraft({
        data: {
          campaignContactId: selected.id,
          feedback: feedback || undefined,
        },
      });
      setEditedSubject(result.subject);
      setEditedBody(result.body);
      setFeedback("");
    } catch (error) {
      handleError(error, "Regenerate failed");
    }
    setIsProcessing(false);
  };

  const moveToNext = () => {
    if (selectedIndex < drafts.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (drafts.length > 1) {
      setSelectedIndex(0);
    }
    navigate({ to: "/review" });
  };

  if (drafts.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
            <p className="text-muted-foreground mb-4">
              No drafts pending review
            </p>
            <Button asChild>
              <Link to="/campaigns">Go to Campaigns</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enrichmentData = selected?.enrichmentData
    ? JSON.parse(selected.enrichmentData)
    : null;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left Panel - List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""} pending
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {drafts.map((draft, index) => (
            <button
              key={draft.id}
              onClick={() => setSelectedIndex(index)}
              className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${
                index === selectedIndex ? "bg-muted" : ""
              }`}
            >
              <p className="font-medium truncate">
                {draft.contact.firstName} {draft.contact.lastName}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {draft.contact.company?.name || draft.contact.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {draft.campaign.product}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-1 flex flex-col">
        {selected && (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selected.contact.firstName} {selected.contact.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.contact.email}
                    {selected.contact.company &&
                      ` • ${selected.contact.company.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                    disabled={selectedIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedIndex + 1} / {drafts.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedIndex(Math.min(drafts.length - 1, selectedIndex + 1))
                    }
                    disabled={selectedIndex === drafts.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Research Context */}
              {enrichmentData && (
                <Card>
                  <CardHeader
                    className="py-3 cursor-pointer"
                    onClick={() => setShowResearch(!showResearch)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Research Context
                      </CardTitle>
                      <Badge variant="secondary">
                        {showResearch ? "Hide" : "Show"}
                      </Badge>
                    </div>
                  </CardHeader>
                  {showResearch && (
                    <CardContent className="pt-0 space-y-2">
                      {enrichmentData.results?.slice(0, 3).map((r: any, i: number) => (
                        <div key={i} className="text-sm">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {r.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <p className="text-muted-foreground text-xs line-clamp-2">
                            {r.highlights?.join(" ") || r.text?.substring(0, 200)}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Email Editor */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="body">Body</Label>
                  <Textarea
                    id="body"
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={12}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Regenerate */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Regenerate with Feedback</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Textarea
                    placeholder="Optional feedback (e.g., 'Make it shorter', 'Focus more on compliance')..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isProcessing}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {isProcessing ? "Regenerating..." : "Regenerate"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-center justify-between">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  <X className="mr-2 h-4 w-4" />
                  Skip
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleApprove}
                    disabled={isProcessing}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button onClick={handleApproveAndSend} disabled={isProcessing}>
                    <Send className="mr-2 h-4 w-4" />
                    {isProcessing ? "Processing..." : "Approve & Send"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
