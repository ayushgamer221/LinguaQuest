import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BookOpen, Home, Target, User, Crown, Menu, X } from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/lessons", label: "Lessons", icon: BookOpen },
    { href: "/quests", label: "Quests", icon: Target },
    { href: "/pricing", label: "Pricing", icon: Crown },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={user ? "/dashboard" : "/"}>
            <div className="flex items-center gap-2 cursor-pointer">
              <BookOpen className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold hidden sm:inline">LinguaQuest</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {user && navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            {!user && (
              <Link href="/auth">
                <Button size="sm" data-testid="nav-login">Login</Button>
              </Link>
            )}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t p-4 space-y-2 bg-background">
            {user ? (
              navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={location === item.href ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))
            ) : (
              <Link href="/auth">
                <Button className="w-full" onClick={() => setMobileMenuOpen(false)}>
                  Login
                </Button>
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
          <div className="flex items-center justify-around py-2">
            {navItems.slice(0, 4).map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-col gap-1 h-auto py-2 ${location === item.href ? "text-primary" : "text-muted-foreground"}`}
                  data-testid={`bottom-nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </nav>
      )}

      {user && <div className="md:hidden h-16" />}
    </div>
  );
}
