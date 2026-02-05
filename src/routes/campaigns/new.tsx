import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { handleError } from "@/lib/handle-error";
import { createCampaign } from "@/lib/server/campaigns";
import { getProducts } from "@/lib/server/products";
import { getGmailAccounts } from "@/lib/server/gmail-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Mail } from "lucide-react";

export const Route = createFileRoute("/campaigns/new")({
  component: NewCampaign,
  loader: async () => {
    const [products, gmailAccounts] = await Promise.all([
      getProducts(),
      getGmailAccounts(),
    ]);
    return { products, gmailAccounts };
  },
});

function NewCampaign() {
  const navigate = useNavigate();
  const { products, gmailAccounts } = Route.useLoaderData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    product: "",
    description: "",
    templatePrompt: "",
    gmailAccountId: gmailAccounts[0]?.id || "",
  });

  const selectedProduct = products.find((p) => p.id === formData.product);
  let selectedValueProps: string[] = [];
  if (selectedProduct) {
    try {
      selectedValueProps = JSON.parse(selectedProduct.valueProps);
    } catch {
      // Invalid JSON, use empty array
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product) return;

    setIsSubmitting(true);

    try {
      const campaign = await createCampaign({
        data: {
          name: formData.name,
          product: formData.product,
          description: formData.description || undefined,
          templatePrompt: formData.templatePrompt || undefined,
          gmailAccountId: formData.gmailAccountId || undefined,
        },
      });
      navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
    } catch (error) {
      handleError(error, "Failed to create campaign");
      setIsSubmitting(false);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create New Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">
                  Campaign Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Q1 Law Firm Outreach"
                />
              </div>

              <div>
                <Label htmlFor="product">
                  Product <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.product}
                  onValueChange={(value) =>
                    setFormData({ ...formData, product: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {gmailAccounts.length > 0 && (
                <div>
                  <Label htmlFor="gmailAccount">
                    Send From <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.gmailAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gmailAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sender account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gmailAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {account.label || account.userEmail}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emails will be sent from this Gmail account
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Internal notes about this campaign..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="templatePrompt">
                  Custom Prompt (Optional)
                </Label>
                <Textarea
                  id="templatePrompt"
                  value={formData.templatePrompt}
                  onChange={(e) =>
                    setFormData({ ...formData, templatePrompt: e.target.value })
                  }
                  placeholder="Additional instructions for email drafting..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be added to the AI prompt when drafting emails
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.product}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create Campaign"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/campaigns">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Product Preview */}
        {selectedProduct && (
          <Card>
            <CardHeader>
              <CardTitle>Product: {selectedProduct.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p>{selectedProduct.description}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Value Propositions
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {selectedValueProps.map((prop, i) => (
                    <li key={i} className="text-sm">
                      {prop}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Target Audience
                </p>
                <p>{selectedProduct.targetAudience}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
