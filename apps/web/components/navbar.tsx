"use client";

import { useCallback, useEffect, useState } from "react";

import { getCurrentUser, signOut } from "@/actions/auth";
import { Payroutes, StellarTools } from "@/components/icon";
import ModeToggle from "@/components/mode-toggle";
import { Menu } from "@aliimam/icons";
import {
  AppModal,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
  toast,
} from "@stellartools/shared-ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_LINKS = [
  { href: process.env.NEXT_PUBLIC_DOCS_URL!, label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/team", label: "Team" },
  { href: "https://github.com/payrouteshq/stellartools", label: "GitHub" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const { data: user, isLoading } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUser(),
  });

  console.log({ user });

  const isAuthenticated = !!user;

  const userName = user?.profile.firstName
    ? `${user.profile.firstName} ${user.profile.lastName || ""}`.trim()
    : user?.email.split("@")[0] || "User";

  const userInitials = (user?.profile.firstName?.[0] || user?.email?.[0] || "?").toUpperCase();

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      router.push(`/signin?next=${pathname}`);
      AppModal.close();
    } catch (error) {
      toast.error("Failed to log out");
      console.error("Logout error:", error);
    }
  }, [router, pathname]);

  const openLogoutConfirm = useCallback(() => {
    AppModal.open({
      title: "Log out",
      description: "Are you sure you want to log out? You'll need to sign in again to access your account.",
      content: (
        <div className="py-4">
          <p className="text-muted-foreground text-sm">
            This will end your current session and you&apos;ll be redirected to the sign in page.
          </p>
        </div>
      ),
      size: "small",
      showCloseButton: true,
      primaryButton: { children: "Log out", variant: "destructive", onClick: handleLogout },
      secondaryButton: { children: "Cancel" },
    });
  }, [handleLogout]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full">
      <div className="px-4 pt-3 pb-1 md:hidden">
        <div className="bg-background/95 border-border flex items-center justify-between rounded-2xl border px-4 py-2.5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Link href="https://payroutes.sh" target="_blank">
              <Payroutes className="text-foreground size-7" />
            </Link>
            <span className="text-foreground text-sm">/</span>
            <Link className="flex items-center gap-2" href="/" target="_blank">
              <StellarTools width={28} height={28} className="text-foreground size-7 rounded-md object-contain" />
              <span className="font-rosemary text-foreground text-base font-semibold">StellarTools</span>
            </Link>
          </div>

          <button
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="border-border hover:bg-muted flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="inset-0! top-0! left-0! m-0! flex h-screen! w-screen! max-w-none! translate-x-0! translate-y-0! flex-col gap-0 rounded-none border-none p-0">
          <DialogTitle className="sr-only">Navigation menu</DialogTitle>

          <div className="flex items-center justify-between px-8 pt-8">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Avatar className="size-8 border">
                  <AvatarImage src={user?.profile.avatarUrl || ""} alt={userName} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <p className="text-foreground text-sm font-semibold">{userName}</p>
                  <p className="text-muted-foreground text-xs">{user?.email}</p>
                </div>
              </div>
            ) : (
              <span />
            )}
            <ModeToggle />
          </div>

          <nav className="flex flex-1 flex-col justify-center gap-1 px-8">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                target={href.startsWith("http") ? "_blank" : undefined}
                className="text-foreground hover:text-primary flex items-center justify-between border-b py-5 text-[22px] font-semibold no-underline transition-colors last:border-b-0"
              >
                {label}
                <span className="text-muted-foreground text-base">→</span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 px-8 pb-12">
            <Link
              href="/book-call"
              onClick={() => setMenuOpen(false)}
              className="border-border block rounded-xl border px-5 py-4 text-center text-[15px] font-semibold no-underline"
            >
              Talk to us →
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="bg-primary text-primary-foreground block rounded-xl px-5 py-4 text-center text-[15px] font-semibold no-underline"
                >
                  Go to Dashboard →
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="border-border block rounded-xl border px-5 py-4 text-center text-[15px] font-semibold no-underline"
                >
                  Account Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openLogoutConfirm();
                  }}
                  className="text-destructive block rounded-xl px-5 py-4 text-center text-[15px] font-semibold"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/signup`}
                  onClick={() => setMenuOpen(false)}
                  className="bg-primary text-primary-foreground block rounded-xl px-5 py-4 text-center text-[15px] font-semibold no-underline"
                >
                  Start for free →
                </Link>
                <Link
                  href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/signin`}
                  onClick={() => setMenuOpen(false)}
                  className="text-muted-foreground hover:text-foreground block rounded-xl px-5 py-4 text-center text-[15px] font-medium no-underline transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "hidden border-b backdrop-blur-md transition-all duration-300 md:block",
          scrolled ? "border-border bg-background/90" : "bg-background/90 border-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Link href="https://payroutes.sh" target="_blank">
              <Payroutes className="text-foreground size-8" />
            </Link>
            <span className="text-foreground">/</span>
            <Link className="flex items-center gap-2" href="/">
              <StellarTools width={32} height={32} className="text-foreground" />
              <span className="font-rosemary text-foreground text-lg font-semibold">StellarTools</span>
            </Link>
          </div>

          <ul className="flex list-none gap-8">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-muted-foreground hover:text-foreground text-[14.5px] font-medium no-underline transition-colors"
                  target={href.startsWith("http") ? "_blank" : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/book-call"
              className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-lg px-4 py-2 text-[14.5px] font-medium whitespace-nowrap no-underline transition-colors"
            >
              Talk to us →
            </Link>
            {isLoading ? (
              <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
            ) : isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="size-8 cursor-pointer border">
                      <AvatarImage src={user?.profile.avatarUrl || ""} alt={userName} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="end">
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Avatar className="size-8 rounded-lg">
                          <AvatarImage src={user?.profile.avatarUrl || ""} alt={userName} />
                          <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left leading-tight">
                          <span className="truncate text-sm font-semibold">{userName}</span>
                          <span className="text-muted-foreground truncate text-xs">{user?.email}</span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard">Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">Account Settings</Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="justify-between" onSelect={(e) => e.preventDefault()}>
                      Theme <ModeToggle />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={openLogoutConfirm}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link
                  href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/signin`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-4 py-2 text-[14.5px] font-medium no-underline transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/signup`}
                  className="bg-primary text-primary-foreground rounded-[9px] px-5 py-2 text-[14.5px] font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
                >
                  Start for free →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
