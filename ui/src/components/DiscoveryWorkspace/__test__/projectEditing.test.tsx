import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryWorkspace } from "../DiscoveryWorkspace";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@crabnebula/tauri-plugin-drag", () => ({ startDrag: vi.fn() }));

type StoredRow = { readonly sample: { readonly id: number; readonly file_name: string; readonly path: string }; status: string; note: string };
let rows: StoredRow[] = [];
beforeEach(() => {
  rows = [1, 2].map((id) => ({ sample: { id, file_name: `${id}.wav`, path: `/samples/${id}.wav` }, status: "candidate", note: "" }));
  invoke.mockImplementation(async (command: string, args: unknown) => {
    switch (command) {
      case "query_discovery": return rows.map((row) => ({ ...row }));
      case "list_collections": return [{ id: 1, name: "Song", created_at: "2026-11-03", sample_count: 2 }, { id: 2, name: "Other", created_at: "2026-11-03", sample_count: 0 }];
      case "list_smart_collections": return [];
      case "update_project_member": {
        if (typeof args !== "object" || args === null || !("update" in args)) throw new Error("Missing update");
        const update = args.update;
        if (typeof update !== "object" || update === null || !("sample_id" in update) || !("note" in update) || !("status" in update)) throw new Error("Invalid update");
        const row = rows.find((entry) => entry.sample.id === update.sample_id);
        if (row && typeof update.note === "string" && typeof update.status === "string") { row.note = update.note; row.status = update.status; }
        return null;
      }
      default: throw new Error(`Unexpected ${command}`);
    }
  });
});

describe("project editing", () => {
  it("retains another row's unsaved note and adoption when a saved row reloads the shelf", async () => {
    render(<DiscoveryWorkspace selected={null} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.change(await screen.findByLabelText("Project"), { target: { value: "1" } });
    await waitFor(() => expect(screen.getAllByLabelText("Notes")).toHaveLength(2));
    const first = screen.getByText("1.wav").closest("li"), second = screen.getByText("2.wav").closest("li");
    if (!first || !second) throw new Error("Project rows missing");
    fireEvent.change(within(first).getByLabelText("Notes"), { target: { value: "saved first" } });
    fireEvent.change(within(second).getByLabelText("Notes"), { target: { value: "unsaved second" } });
    fireEvent.change(within(second).getByLabelText("Adoption status"), { target: { value: "adopted" } });
    await act(async () => { fireEvent.click(within(first).getByRole("button", { name: "Save" })); });
    await waitFor(() => expect(screen.queryByText("Loading samples…")).not.toBeInTheDocument());
    expect(rows[0]?.note).toBe("saved first");
    expect(rows[1]?.note).toBe("");
    const nextRows = screen.getAllByRole("listitem");
    const nextSecond = nextRows[1];
    if (!nextSecond) throw new Error("Second row missing after reload");
    expect(within(nextSecond).getByLabelText("Notes")).toHaveValue("unsaved second");
    expect(within(nextSecond).getByLabelText("Adoption status")).toHaveValue("adopted");
    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "2" } });
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "1" } });
    await waitFor(() => expect(screen.getAllByLabelText("Notes")[1]).toHaveValue("unsaved second"));
  });
});
