import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  getProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/server/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Plus, X, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/products/$id")({
  component: EditProduct,
  loader: ({ params }) => getProduct({ data: { id: params.id } }),
});

function EditProduct() {
  const navigate = useNavigate();
  const product = Route.useLoaderData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetAudience: "",
    enrichmentQueryTemplate: "",
    emailSystemPrompt: "",
  });
  const [valueProps, setValueProps] = useState<string[]>([""]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description,
        targetAudience: product.targetAudience,
        enrichmentQueryTemplate: product.enrichmentQueryTemplate,
        emailSystemPrompt: product.emailSystemPrompt,
      });
      try {
        setValueProps(JSON.parse(product.valueProps));
      } catch {
        setValueProps([""]);
      }
    }
  }, [product]);

  if (!product) {
    return (
      <div className="p-6">
        <p>Product not found</p>
        <Button asChild className="mt-4">
          <Link to="/products">Back to Products</Link>
        </Button>
      </div>
    );
  }

  const handleAddValueProp = () => {
    setValueProps([...valueProps, ""]);
  };

  const handleRemoveValueProp = (index: number) => {
    setValueProps(valueProps.filter((_, i) => i !== index));
  };

  const handleValuePropChange = (index: number, value: string) => {
    const updated = [...valueProps];
    updated[index] = value;
    setValueProps(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filteredValueProps = valueProps.filter((v) => v.trim() !== "");
    if (filteredValueProps.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateProduct({
        data: {
          id: product.id,
          name: formData.name,
          description: formData.description,
          valueProps: filteredValueProps,
          targetAudience: formData.targetAudience,
          enrichmentQueryTemplate: formData.enrichmentQueryTemplate,
          emailSystemPrompt: formData.emailSystemPrompt,
        },
      });
      navigate({ to: "/products" });
    } catch (err) {
      console.error("Failed to update product:", err);
      setError(err instanceof Error ? err.message : "Failed to update product");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteProduct({ data: { id: product.id } });
      navigate({ to: "/products" });
    } catch (err) {
      console.error("Failed to delete product:", err);
      setError(err instanceof Error ? err.message : "Failed to delete product");
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          {product.isDefault && <Badge variant="secondary">Default</Badge>}
        </div>
        {!product.isDefault && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this product? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="My Product"
              />
            </div>

            <div>
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="What does this product do?"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="targetAudience">
                Target Audience <span className="text-destructive">*</span>
              </Label>
              <Input
                id="targetAudience"
                required
                value={formData.targetAudience}
                onChange={(e) =>
                  setFormData({ ...formData, targetAudience: e.target.value })
                }
                placeholder="Who is this product for?"
              />
            </div>

            <div>
              <Label>
                Value Propositions <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2">
                {valueProps.map((prop, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={prop}
                      onChange={(e) =>
                        handleValuePropChange(index, e.target.value)
                      }
                      placeholder={`Value prop ${index + 1}`}
                    />
                    {valueProps.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveValueProp(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddValueProp}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Value Prop
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="enrichmentQueryTemplate">
                Enrichment Query Template{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="enrichmentQueryTemplate"
                required
                value={formData.enrichmentQueryTemplate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enrichmentQueryTemplate: e.target.value,
                  })
                }
                placeholder="{{companyName}} industry keywords..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{companyName}}"} as a placeholder for the company name
              </p>
            </div>

            <div>
              <Label htmlFor="emailSystemPrompt">
                Email System Prompt <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="emailSystemPrompt"
                required
                value={formData.emailSystemPrompt}
                onChange={(e) =>
                  setFormData({ ...formData, emailSystemPrompt: e.target.value })
                }
                placeholder="Instructions for the AI when drafting emails..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This prompt guides the AI when drafting cold emails for this
                product
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !formData.name ||
                  !formData.description ||
                  valueProps.filter((v) => v.trim()).length === 0
                }
              >
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/products">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
