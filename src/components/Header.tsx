import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  Menu,
  Users,
  Building2,
  Megaphone,
  FileCheck,
  Upload,
  Plus,
  X,
  Settings,
  Package,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/products", label: "Products", icon: Package },
  { to: "/review", label: "Review Queue", icon: FileCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

const quickActions = [
  { to: "/contacts/new", label: "Add Contact", icon: Plus },
  { to: "/contacts/import", label: "Import CSV", icon: Upload },
  { to: "/campaigns/new", label: "New Campaign", icon: Plus },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-background">
        <div className="flex h-14 items-center px-4 gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-muted rounded-lg transition-colors lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Link to="/" className="font-semibold text-lg">
            Pluto
          </Link>
          <nav className="hidden lg:flex items-center gap-1 ml-6">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                activeProps={{
                  className:
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-muted rounded-md",
                }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {quickActions.slice(0, 2).map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                <action.icon size={14} />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-background border-r z-50 transform transition-transform duration-300 ease-in-out flex flex-col lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-lg">Pluto</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              activeProps={{
                className:
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-foreground bg-muted",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}

          <div className="pt-4 mt-4 border-t">
            <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </p>
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <action.icon size={20} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
