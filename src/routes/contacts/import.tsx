import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { handleError } from "@/lib/handle-error";
import { importContacts } from "@/lib/server/import";
import { getCampaigns } from "@/lib/server/campaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileSpreadsheet, Check, X } from "lucide-react";

const FIELD_OPTIONS = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "domain", label: "Domain" },
  { value: "title", label: "Job Title" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "phone", label: "Phone" },
  { value: "_skip", label: "Skip this column" },
];

export const Route = createFileRoute("/contacts/import")({
  component: ImportContacts,
  loader: () => getCampaigns({}),
});

function ImportContacts() {
  const campaigns = Route.useLoaderData();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);
      setResult(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        const rows = lines.slice(1, 6).map((line) =>
          line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
        );

        setCsvData({ headers, rows });

        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const lower = header.toLowerCase();
          if (lower.includes("first") && lower.includes("name")) {
            autoMapping[header] = "firstName";
          } else if (lower.includes("last") && lower.includes("name")) {
            autoMapping[header] = "lastName";
          } else if (lower === "name" || lower === "full name") {
            autoMapping[header] = "firstName"; // Will need to split
          } else if (lower.includes("email")) {
            autoMapping[header] = "email";
          } else if (lower.includes("company") || lower.includes("organization")) {
            autoMapping[header] = "company";
          } else if (lower.includes("domain") || lower.includes("website")) {
            autoMapping[header] = "domain";
          } else if (lower.includes("title") || lower.includes("position")) {
            autoMapping[header] = "title";
          } else if (lower.includes("linkedin")) {
            autoMapping[header] = "linkedinUrl";
          } else if (lower.includes("phone")) {
            autoMapping[header] = "phone";
          }
        });
        setColumnMapping(autoMapping);
      };
      reader.readAsText(selectedFile);
    },
    []
  );

  const handleImport = async () => {
    if (!file || !csvData) return;

    setIsImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

        const rows = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};

          headers.forEach((header, idx) => {
            const mappedField = columnMapping[header];
            if (mappedField && mappedField !== "_skip" && values[idx]) {
              row[mappedField] = values[idx];
            }
          });

          return row;
        }).filter((row) => row.email);

        const importResult = await importContacts({
          data: {
            rows: rows as any,
            campaignId: selectedCampaign || undefined,
          },
        });

        setResult(importResult);
        setIsImporting(false);
      };
      reader.readAsText(file);
    } catch (error) {
      handleError(error, "Import failed");
      setIsImporting(false);
    }
  };

  const hasEmailMapping = Object.values(columnMapping).includes("email");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/contacts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Contacts from CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div>
              <Label htmlFor="file">CSV File</Label>
              <div className="mt-2">
                <label
                  htmlFor="file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {file ? (
                      <>
                        <FileSpreadsheet className="h-8 w-8 mb-2 text-primary" />
                        <p className="text-sm font-medium">{file.name}</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload or drag and drop
                        </p>
                      </>
                    )}
                  </div>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            {/* Column Mapping */}
            {csvData && (
              <div className="space-y-4">
                <h3 className="font-medium">Map Columns</h3>
                <div className="grid gap-3">
                  {csvData.headers.map((header) => (
                    <div key={header} className="flex items-center gap-4">
                      <span className="w-40 text-sm font-medium truncate">
                        {header}
                      </span>
                      <Select
                        value={columnMapping[header] || ""}
                        onValueChange={(value) =>
                          setColumnMapping({
                            ...columnMapping,
                            [header]: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground truncate flex-1">
                        {csvData.rows[0]?.[csvData.headers.indexOf(header)] ||
                          "-"}
                      </span>
                    </div>
                  ))}
                </div>

                {!hasEmailMapping && (
                  <p className="text-sm text-destructive">
                    Please map at least one column to Email
                  </p>
                )}
              </div>
            )}

            {/* Campaign Selection */}
            {csvData && (
              <div>
                <Label>Add to Campaign (Optional)</Label>
                <Select
                  value={selectedCampaign}
                  onValueChange={setSelectedCampaign}
                >
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue placeholder="Select a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No campaign</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.product})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview */}
            {csvData && csvData.rows.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {csvData.headers.map((header) => (
                          <th key={header} className="px-3 py-2 text-left">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.map((row, i) => (
                        <tr key={i} className="border-t">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Button */}
            {csvData && (
              <Button
                onClick={handleImport}
                disabled={!hasEmailMapping || isImporting}
                className="w-full"
              >
                {isImporting ? "Importing..." : "Import Contacts"}
              </Button>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>{result.created} contacts created</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center gap-2">
                    <X className="h-5 w-5 text-yellow-500" />
                    <span>{result.skipped} duplicates skipped</span>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-destructive mb-1">Errors:</p>
                    {result.errors.slice(0, 5).map((error, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
                <Button asChild className="mt-4">
                  <Link to="/contacts">View Contacts</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
