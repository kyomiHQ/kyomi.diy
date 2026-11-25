"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { logClientError } from "@kyomi/reader/lib/errors";
import { useAuth } from "@integrations/better-auth/provider";
import { Spinner } from "@kyomi/ui/components/spinner";
import { toastManager } from "@kyomi/ui/components/toast";
import { resolveAuthReturnTo } from "@modules/auth/redirect";
import { EmailStep } from "./email-step";
import { useEmailForm } from "./hooks";
import { AccountLayout } from "./layout";
import { OtpStep } from "./otp-step";

export function Login({ redirect, register = false }: { redirect?: string; register?: boolean }) {
  const router = useRouter();
  const { isAuthenticated, isPending } = useAuth();
  const returnTo = resolveAuthReturnTo(redirect);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const leaving = verified || isAuthenticated;

  const emailForm = useEmailForm((sentTo) => {
    setEmail(sentTo);
    setStep("otp");
  });

  useEffect(() => {
    if (!leaving) return;
    // The destination reruns the root session guard with the cookie from OTP verification.
    void router
      .navigate({ href: returnTo, replace: true })
      .then(() => {
        if (router.state.location.pathname.startsWith("/inbox")) {
          toastManager.add({ title: "Logged in", type: "success" });
        }
      })
      .catch((error) => {
        logClientError("auth.open_inbox", error);
        toastManager.add({ title: "Could not open your inbox", type: "error" });
      });
  }, [leaving, returnTo, router]);

  if (isPending || leaving) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
          <Spinner aria-hidden className="size-4" />
          <span>Loading</span>
        </div>
      </main>
    );
  }

  return (
    <AccountLayout
      register={register}
      redirect={redirect}
      onBack={step === "otp" ? () => setStep("email") : undefined}
    >
      {step === "email" ? (
        <EmailStep emailForm={emailForm} register={register} />
      ) : (
        <OtpStep email={email} onVerified={() => setVerified(true)} />
      )}
    </AccountLayout>
  );
}
