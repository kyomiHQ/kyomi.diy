import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@lib/auth/client";
import { logClientError } from "@kyomi/reader/lib/errors";
import { toastManager } from "@kyomi/ui/components/toast";
import {
  emailOtpDefaultValues,
  emailOtpFormValidator,
  otpDefaultValues,
  otpFormValidator,
} from "@modules/auth/schema";

export function useEmailForm(onSent: (email: string) => void) {
  return useForm({
    defaultValues: emailOtpDefaultValues,
    validators: {
      onChange: emailOtpFormValidator,
      onSubmit: emailOtpFormValidator,
    },
    onSubmit: async ({ value }) => {
      await toastManager.promise(
        (async () => {
          const result = await authClient.emailOtp.sendVerificationOtp({
            email: value.email,
            type: "sign-in",
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Could not send sign-in code");
          }

          onSent(value.email);
        })(),
        {
          error: (error) => {
            logClientError("auth.send_otp", error);
            return {
              title: "Error sending code",
              type: "error",
            };
          },
          loading: {
            timeout: 0,
            title: "Sending code",
            type: "loading",
          },
          success: {
            title: "Code sent",
            type: "success",
          },
        },
      );
    },
  });
}

export function useOtpForm(email: string, onVerified: () => void) {
  return useForm({
    defaultValues: otpDefaultValues,
    validators: {
      onChange: otpFormValidator,
      onSubmit: otpFormValidator,
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: value.otp,
        });

        if (result.error) {
          throw new Error(result.error.message?.trim() || "Invalid code");
        }

        onVerified();
      } catch (error) {
        logClientError("auth.verify_otp", error);
        toastManager.add({
          title: "Verification failed",
          type: "error",
        });
      }
    },
  });
}

export function useResendCode(email: string) {
  const [isResending, setIsResending] = useState(false);
  const handleResendCode = async () => {
    if (!email || isResending) return;
    setIsResending(true);
    try {
      await toastManager.promise(
        (async () => {
          const result = await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "sign-in",
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Could not resend code");
          }
        })(),
        {
          error: (error) => {
            logClientError("auth.resend_otp", error);
            return {
              title: "Resend failed",
              type: "error",
            };
          },
          loading: {
            timeout: 0,
            title: "Resending code",
            type: "loading",
          },
          success: {
            title: "Code sent",
            type: "success",
          },
        },
      );
    } finally {
      setIsResending(false);
    }
  };

  return { handleResendCode, isResending };
}
