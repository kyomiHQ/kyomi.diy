import {
  Outlet,
  createFileRoute,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { AppShell } from "@/app/shell";
import { RouteErrorPage } from "@/app/error";
import { DefaultNotFoundPage } from "@/app/not-found";
import { PreferredLocale, resolvePreferredLocale } from "@lib/locale";
import { queryKeys } from "@lib/query/keys";
import { INBOX_RECOVERY_ACTION } from "@lib/recovery";
import { useReaderPreferences } from "@modules/reader/hooks/use-preferences";
import { getReaderPreferences } from "@modules/reader/lib/preferences";
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
  loader: async ({ context }) => {
    const userId = context.authState.session?.user.id;
    if (!userId) return;
    await context.queryClient
      .ensureQueryData({
        queryKey: queryKeys.preferences.reader(userId),
        queryFn: getReaderPreferences,
      })
      .catch(() => undefined);
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
  const locale = resolvePreferredLocale(preferences.language);

  return (
    <PreferredLocale value={locale}>
      <AppShell>
        <Outlet />
      </AppShell>
    </PreferredLocale>
  );
}
