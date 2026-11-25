// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Login } from "@modules/auth/components/login";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isPending: false },
  router: {
    navigate: vi.fn(() => Promise.resolve()),
    state: { location: { pathname: "/inbox" } },
  },
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
    signIn: { emailOtp: mocks.signInEmailOtp },
  },
}));

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
  Link: ({ children }: { children: string }) => <a href="/register">{children}</a>,
}));

vi.mock("@kyomi/ui/components/toast", () => ({
  toastManager: {
    add: mocks.toastAdd,
    promise: <Value,>(promise: Promise<Value>) => promise,
  },
}));

function renderLogin(register = false) {
  return render(<Login redirect="/inbox" register={register} />);
}

function getOtpInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('[data-slot="otp-field-input"]'));
}

async function submitEmail(email: string) {
  fireEvent.change(screen.getByPlaceholderText("Enter your email"), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  });
}

async function reachOtpStep(container: HTMLElement) {
  mocks.sendVerificationOtp.mockResolvedValue({ error: null });
  await submitEmail("reader@example.com");
  await screen.findByText("Enter verification code");
  return getOtpInputs(container);
}

beforeEach(() => {
  mocks.sendVerificationOtp.mockReset();
  mocks.signInEmailOtp.mockReset();
  mocks.toastAdd.mockReset();
  mocks.router.navigate.mockClear();
  mocks.authState.isAuthenticated = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Login", () => {
  test("uses the email input itself as the full field control", () => {
    renderLogin();

    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveProperty("tagName", "INPUT");
    expect(email.parentElement?.getAttribute("data-slot")).toBe("field");
  });

  test("keeps Continue loading while the sign-in code is being sent", async () => {
    const send = defer<{ error: null }>();
    mocks.sendVerificationOtp.mockReturnValue(send.promise);
    renderLogin();

    await submitEmail("reader@example.com");

    const button = screen.getByRole("button", { name: /Continue/ });
    expect(button.hasAttribute("data-loading")).toBe(true);
    expect(button).toHaveProperty("disabled", true);

    await act(async () => {
      send.resolve({ error: null });
    });

    expect(await screen.findByText("Enter verification code")).toBeTruthy();
  });

  test("verifies the code as soon as the sixth digit is entered", async () => {
    const verify = defer<{ error: null }>();
    mocks.signInEmailOtp.mockReturnValue(verify.promise);
    const { container } = renderLogin();
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "123456" } });
    });

    await waitFor(() => expect(mocks.signInEmailOtp).toHaveBeenCalledTimes(1));
    expect(mocks.signInEmailOtp).toHaveBeenCalledWith({
      email: "reader@example.com",
      otp: "123456",
    });
    expect(screen.getByRole("button", { name: /Continue/ }).hasAttribute("data-loading")).toBe(
      true,
    );

    await act(async () => {
      verify.resolve({ error: null });
    });

    await waitFor(() =>
      expect(mocks.router.navigate).toHaveBeenCalledWith({ href: "/inbox", replace: true }),
    );
  });

  test("keeps the OTP form hidden while the verified registration navigates once", async () => {
    const navigation = defer<void>();
    mocks.router.navigate.mockReturnValueOnce(navigation.promise);
    mocks.signInEmailOtp.mockResolvedValue({ error: null });
    const { container, rerender } = renderLogin(true);
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "123456" } });
    });

    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(screen.queryByText("Enter verification code")).toBeNull();
    expect(mocks.router.navigate).toHaveBeenCalledTimes(1);

    mocks.authState.isAuthenticated = true;
    rerender(<Login redirect="/inbox" register />);
    expect(screen.queryByText("Enter verification code")).toBeNull();
    expect(mocks.router.navigate).toHaveBeenCalledTimes(1);

    await act(async () => navigation.resolve());
  });

  test("waits for a complete code before verifying", async () => {
    const { container } = renderLogin();
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "12345" } });
    });

    expect(mocks.signInEmailOtp).not.toHaveBeenCalled();
  });

  test("reports a rejected code and lets the reader try again", async () => {
    mocks.signInEmailOtp.mockResolvedValue({ error: { message: "Invalid code" } });
    const { container } = renderLogin();
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "123456" } });
    });

    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Verification failed", type: "error" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Continue/ }).hasAttribute("data-loading")).toBe(
        false,
      ),
    );
    expect(mocks.router.navigate).not.toHaveBeenCalled();
  });
});
