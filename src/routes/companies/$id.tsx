import { createFileRoute, Link } from "@tanstack/react-router";
import { handleError } from "@/lib/handle-error";
import { getCompany } from "@/lib/server/companies";
import { enrichCompany } from "@/lib/server/enrichment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Globe,
  Users,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/companies/$id")({
  component: CompanyDetail,
  loader: ({ params }) => getCompany({ data: { id: params.id } }),
});

function CompanyDetail() {
  const company = Route.useLoaderData();
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<any>(
    company?.enrichmentData ? JSON.parse(company.enrichmentData) : null
  );

  if (!company) {
    return (
      <div className="p-6">
        <p>Company not found</p>
        <Button asChild className="mt-4">
          <Link to="/companies">Back to Companies</Link>
        </Button>
      </div>
    );
  }

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const updated = await enrichCompany({ data: { companyId: company.id } });
      if (updated.enrichmentData) {
        setEnrichmentData(JSON.parse(updated.enrichmentData));
      }
    } catch (error) {
      handleError(error, "Enrichment failed");
    }
    setIsEnriching(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-muted-foreground" />
                <div>
                  <CardTitle>{company.name}</CardTitle>
                  {company.domain && (
                    <a
                      href={`https://${company.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Globe className="h-3 w-3" />
                      {company.domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <Button
                onClick={handleEnrich}
                disabled={isEnriching}
                variant={enrichmentData ? "outline" : "default"}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isEnriching
                  ? "Enriching..."
                  : enrichmentData
                  ? "Re-enrich"
                  : "Enrich with Exa"}
              </Button>
            </CardHeader>
            <CardContent>
              {enrichmentData && (
                <div className="space-y-4">
                  <h3 className="font-medium">Research Results</h3>
                  <p className="text-sm text-muted-foreground">
                    Query: {enrichmentData.query}
                  </p>
                  <div className="space-y-3">
                    {enrichmentData.results?.map((result: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          {result.title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {result.highlights && result.highlights.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {result.highlights.join(" ")}
                          </p>
                        )}
                        {!result.highlights && result.text && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {result.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!enrichmentData && (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No enrichment data yet</p>
                  <p className="text-sm">
                    Click "Enrich with Exa" to research this company
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          {company.contacts && company.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contacts ({company.contacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {company.contacts.map((contact) => (
                    <Link
                      key={contact.id}
                      to="/contacts/$id"
                      params={{ id: contact.id }}
                      className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded"
                    >
                      <div>
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {contact.email}
                        </p>
                      </div>
                      {contact.title && (
                        <Badge variant="outline">{contact.title}</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{company.name}</p>
              </div>
              {company.domain && (
                <div>
                  <p className="text-sm text-muted-foreground">Domain</p>
                  <p className="font-medium">{company.domain}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Contacts</p>
                <p className="font-medium">{company.contacts?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enriched</p>
                <p className="font-medium">
                  {company.enrichedAt
                    ? new Date(company.enrichedAt).toLocaleDateString()
                    : "Not yet"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(company.createdAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
