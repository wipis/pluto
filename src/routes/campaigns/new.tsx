import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createCampaign } from "@/lib/server/campaigns";
import { getProductList, type ProductId } from "@/lib/products";
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
import { ArrowLeft, Save } from "lucide-react";

const products = getProductList();

export const Route = createFileRoute("/campaigns/new")({
  component: NewCampaign,
});

function NewCampaign() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    product: "" as ProductId | "",
    description: "",
    templatePrompt: "",
  });

  const selectedProduct = products.find((p) => p.id === formData.product);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product) return;

    setIsSubmitting(true);

    try {
      const campaign = await createCampaign({
        data: {
          name: formData.name,
          product: formData.product as ProductId,
          description: formData.description || undefined,
          templatePrompt: formData.templatePrompt || undefined,
        },
      });
      navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
    } catch (error) {
      console.error("Failed to create campaign:", error);
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
                    setFormData({ ...formData, product: value as ProductId })
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
                  {selectedProduct.valueProps.map((prop, i) => (
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
