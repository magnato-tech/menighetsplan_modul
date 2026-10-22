// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import {
  UnsavedChangesContext,
  useLeaveGuard,
  useReportUnsaved,
  useUnsavedRegistry,
} from "../src/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "../src/pages/admin/tabs/pages/UnsavedChangesDialog";

// Backlog 4: changes not saved are asked about also when one leaves the studio or closes the browser,
// and the side menu marks the tab that holds them.

afterEach(cleanup);

describe("Spørsmålet før man går", () => {
  test("uten endringer skjer det med en gang", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useLeaveGuard(false, async () => true));
    act(() => result.current.leave(action));
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.dialog.open).toBe(false);
  });

  test("med endringer spørres det; Lagre lagrer og går, Bli her blir", async () => {
    const action = vi.fn();
    const save = vi.fn(async () => true);
    const { result } = renderHook(() => useLeaveGuard(true, save));
    act(() => result.current.leave(action));
    expect(result.current.dialog.open).toBe(true);
    act(() => result.current.dialog.onStay());
    expect(result.current.dialog.open).toBe(false);
    expect(action).not.toHaveBeenCalled();

    act(() => result.current.leave(action));
    await act(() => result.current.dialog.onSave());
    expect(save).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
  });

  test("lagres det ikke, blir man der", async () => {
    const action = vi.fn();
    const { result } = renderHook(() => useLeaveGuard(true, async () => false));
    act(() => result.current.leave(action));
    await act(() => result.current.dialog.onSave());
    expect(action).not.toHaveBeenCalled();
  });

  test("teksten sier hva som er endret", () => {
    render(<UnsavedChangesDialog open what="artikkelen" onSave={vi.fn()} onDiscard={vi.fn()} onStay={vi.fn()} />);
    expect(screen.getByText(/Du har endret artikkelen uten å lagre/)).toBeTruthy();
  });
});

function Editor({ unsaved }: { unsaved: boolean }) {
  useReportUnsaved("cms-nyheter", unsaved, "Påskefest", async () => true);
  return null;
}

function Studio({ unsaved }: { unsaved: boolean }) {
  const { entries, registry } = useUnsavedRegistry();
  return (
    <UnsavedChangesContext.Provider value={registry}>
      <Editor unsaved={unsaved} />
      <p data-testid="tabs">{Object.keys(entries).join(",")}</p>
    </UnsavedChangesContext.Provider>
  );
}

describe("Studioet vet hvor det er endringer", () => {
  test("fanen meldes, og nettleseren spør før den lukkes", () => {
    const { rerender } = render(<Studio unsaved={true} />);
    expect(screen.getByTestId("tabs").textContent).toBe("cms-nyheter");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    rerender(<Studio unsaved={false} />);
    expect(screen.getByTestId("tabs").textContent).toBe("");
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
