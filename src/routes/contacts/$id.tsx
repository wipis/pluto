import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getContact, updateContact, deleteContact } from "@/lib/server/contacts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  Save,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/contacts/$id")({
  component: ContactDetail,
  loader: ({ params }) => getContact({ data: { id: params.id } }),
});

function ContactDetail() {
  const contact = Route.useLoaderData();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formData, setFormData] = useState({
    firstName: contact?.firstName || "",
    lastName: contact?.lastName || "",
    email: contact?.email || "",
    title: contact?.title || "",
    phone: contact?.phone || "",
    linkedinUrl: contact?.linkedinUrl || "",
    notes: contact?.notes || "",
  });

  if (!contact) {
    return (
      <div className="p-6">
        <p>Contact not found</p>
        <Button asChild className="mt-4">
          <Link to="/contacts">Back to Contacts</Link>
        </Button>
      </div>
    );
  }

  const handleSave = async () => {
    await updateContact({ data: { id: contact.id, ...formData } });
    setIsEditing(false);
    navigate({ to: "/contacts/$id", params: { id: contact.id } });
  };

  const handleDelete = async () => {
    await deleteContact({ data: { id: contact.id } });
    navigate({ to: "/contacts" });
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contact Information</CardTitle>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDelete(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name</Label>
                  {isEditing ? (
                    <Input
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                    />
                  ) : (
                    <p className="mt-1">{contact.firstName || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>Last Name</Label>
                  {isEditing ? (
                    <Input
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                    />
                  ) : (
                    <p className="mt-1">{contact.lastName || "-"}</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                ) : (
                  <p className="mt-1">{contact.email}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Title
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                ) : (
                  <p className="mt-1">{contact.title || "-"}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                ) : (
                  <p className="mt-1">{contact.phone || "-"}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.linkedinUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, linkedinUrl: e.target.value })
                    }
                  />
                ) : contact.linkedinUrl ? (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline mt-1 block"
                  >
                    {contact.linkedinUrl}
                  </a>
                ) : (
                  <p className="mt-1">-</p>
                )}
              </div>

              <div>
                <Label>Notes</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={4}
                  />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap">
                    {contact.notes || "-"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          {contact.activities && contact.activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contact.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-4 border-b last:border-0"
                    >
                      <Badge variant="outline" className="mt-0.5">
                        {activity.type.replace(/_/g, " ")}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company */}
          {contact.company && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to="/companies/$id"
                  params={{ id: contact.company.id }}
                  className="font-medium hover:underline"
                >
                  {contact.company.name}
                </Link>
                {contact.company.domain && (
                  <p className="text-sm text-muted-foreground">
                    {contact.company.domain}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Campaigns */}
          {contact.campaignContacts && contact.campaignContacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.campaignContacts.map((cc) => (
                  <div key={cc.id} className="space-y-1">
                    <Link
                      to="/campaigns/$id"
                      params={{ id: cc.campaign.id }}
                      className="font-medium hover:underline block"
                    >
                      {cc.campaign.name}
                    </Link>
                    <Badge variant="secondary">{cc.stage}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Emails */}
          {contact.emails && contact.emails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Email History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.emails.map((email) => (
                  <div key={email.id} className="space-y-1">
                    <p className="font-medium text-sm">{email.subject}</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          email.direction === "outbound"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {email.direction}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {email.sentAt
                          ? new Date(email.sentAt).toLocaleDateString()
                          : "Draft"}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
