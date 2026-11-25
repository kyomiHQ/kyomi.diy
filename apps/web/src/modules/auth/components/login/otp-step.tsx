import { Button } from "@kyomi/ui/components/button";
import { AccountHeading } from "./layout";
import { Form } from "@kyomi/ui/components/form";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/components/field";
import { OTPField, OTPFieldPrimitive, OTPFieldSeparator } from "@kyomi/ui/components/otp-field";
import { getFieldErrorMessage } from "@modules/auth/schema";
import { useResendCode, useOtpForm } from "./hooks";

function OtpDigits({ start }: { start: 1 | 4 }) {
  return (
    <div className="grid h-[calc(11*var(--otp-unit))] min-w-0 flex-1 grid-cols-3 rounded-lg border border-input bg-muted/50 has-aria-invalid:border-destructive/64">
      {[start, start + 1, start + 2].map((digit) => (
        <OTPFieldPrimitive.Input
          key={digit}
          autoFocus={digit === 1}
          aria-label={digit === 1 ? undefined : `Character ${digit} of 6`}
          data-slot="otp-field-input"
          className="w-full min-w-0 border-e border-border bg-transparent text-center font-mono text-[length:calc(4*var(--otp-unit))] text-foreground outline-none transition-[background-color,box-shadow] duration-(--duration-control) first:rounded-s-[calc(var(--radius-lg)-var(--stroke-width))] last:rounded-e-[calc(var(--radius-lg)-var(--stroke-width))] last:border-e-0 focus-visible:bg-background focus-visible:ring-(length:--focus-ring-width) focus-visible:ring-ring focus-visible:ring-inset focus-visible:aria-invalid:ring-destructive"
        />
      ))}
    </div>
  );
}

export function OtpStep({ email, returnTo }: { email: string; returnTo: string }) {
  const otpForm = useOtpForm(email, returnTo);
  const { handleResendCode, isResending } = useResendCode(email);

  return (
    <>
      <AccountHeading title="Enter verification code">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
      </AccountHeading>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void otpForm.handleSubmit();
        }}
      >
        <otpForm.Field name="otp">
          {(field) => {
            const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
            const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

            return (
              <Field className="@container items-center" invalid={Boolean(errorMessage)}>
                <FieldLabel className="sr-only">Verification code</FieldLabel>
                {/* The compact layout is 75 spacing units wide. Grow its geometry with the form. */}
                <OTPField
                  aria-label="Verification code"
                  className="w-full [--otp-unit:max(var(--space-unit),calc(100cqi/75))] sm:gap-[calc(3*var(--otp-unit))]"
                  length={6}
                  autoSubmit
                  value={field.state.value}
                  onValueChange={(val) => field.handleChange(val)}
                >
                  <OtpDigits start={1} />
                  <OTPFieldSeparator className="data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-[calc(2*var(--otp-unit))]" />
                  <OtpDigits start={4} />
                </OTPField>
                {errorMessage ? (
                  <FieldError match={true}>{errorMessage as string}</FieldError>
                ) : null}
              </Field>
            );
          }}
        </otpForm.Field>

        <otpForm.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <Button className="w-full" size="xl" type="submit" loading={Boolean(isSubmitting)}>
              Continue
            </Button>
          )}
        </otpForm.Subscribe>

        <Button
          className="w-full"
          variant="ghost"
          size="xl"
          type="button"
          onClick={() => void handleResendCode()}
          disabled={isResending}
        >
          {isResending ? "Resending…" : "Resend code"}
        </Button>
      </Form>
    </>
  );
}
