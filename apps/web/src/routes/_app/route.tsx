import {
  Outlet,
  createFileRoute,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { AppShell } from "@/app/shell";
import { RouteErrorPage } from "@/app/error";
import { DefaultNotFoundPage } from "@/app/not-found";
import { useHydrated } from "@hooks/use-hydrated";
import { PreferredLocale } from "@lib/locale";
import { INBOX_RECOVERY_ACTION } from "@lib/recovery";
import { useReaderPreferences } from "@modules/reader/hooks/use-preferences";
import { buildAuthEntryHref } from "@modules/auth/redirect";
import { getOnboardingStatus } from "@modules/onboarding/lib/api";
import { getErrorStatus } from "@lib/status";
import { requireAuth, requireCompletedOnboarding } from "@/routes/-guards";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    requireAuth(context.authState, location.href);
    const { status } = await getOnboardingStatus().catch((error) => {
      if (getErrorStatus(error) === 401) {
        throw redirect({ href: buildAuthEntryHref("/", location.href), replace: true });
      }
      throw error;
    });
    requireCompletedOnboarding(status, location.href);
  },
  component: AppLayout,
  errorComponent: AppRouteErrorPage,
  notFoundComponent: DefaultNotFoundPage,
});

/** The shell itself failed, so this is a full page. Content failures stay inside the shell. */
function AppRouteErrorPage(props: ErrorComponentProps) {
  return <RouteErrorPage {...props} recoveryAction={INBOX_RECOVERY_ACTION} />;
}

function AppLayout() {
  const { preferences } = useReaderPreferences();
  const hydrated = useHydrated();
  const preferredLanguage = preferences.language === "ns" ? "nso" : (preferences.language ?? "en");
  const [locale = "en"] = hydrated ? Intl.DateTimeFormat.supportedLocalesOf(preferredLanguage) : [];

  return (
    <PreferredLocale value={locale}>
      <AppShell>
        <Outlet />
      </AppShell>
    </PreferredLocale>
  );
}
