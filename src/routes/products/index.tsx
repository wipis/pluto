import { createFileRoute, Link } from "@tanstack/react-router";
import { getProducts } from "@/lib/server/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";

export const Route = createFileRoute("/products/")({
  component: ProductList,
  loader: () => getProducts(),
});

function ProductList() {
  const products = Route.useLoaderData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">{products.length} products</p>
        </div>
        <Button asChild>
          <Link to="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No products yet</p>
            <Button asChild>
              <Link to="/products/new">Create your first product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            let valueProps: string[] = [];
            try {
              valueProps = JSON.parse(product.valueProps);
            } catch {
              // Invalid JSON, use empty array
            }
            return (
              <Link
                key={product.id}
                to="/products/$id"
                params={{ id: product.id }}
              >
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      {product.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Target Audience
                      </p>
                      <p className="text-sm line-clamp-1">
                        {product.targetAudience}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Value Props
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {valueProps.length} value propositions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
