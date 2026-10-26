// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import axe from "axe-core";
import { Button } from "./Button.js";
import { Field } from "./Field.js";
import { RupiahInput } from "./RupiahInput.js";
import { Table } from "./Table.js";
import { Toast } from "./Toast.js";

afterEach(cleanup);

describe("Phase 0 accessible UI primitives", () => {
  it("renders semantic controls and has no WCAG A/AA axe violations", async () => {
    render(
      <main>
        <h1>Contoh komponen</h1>
        <Field id="amount" label="Nominal" hint="Masukkan jumlah Rupiah.">
          <input id="amount" aria-describedby="amount-hint" />
        </Field>
        <Button>Simpan</Button>
        <Table
          caption="Rincian"
          columns={[{ key: "label", header: "Keterangan", render: (row: { label: string }) => row.label }]}
          rows={[{ label: "Pokok" }]}
          rowKey={(row) => row.label}
        />
        <Toast>Perubahan tersimpan.</Toast>
      </main>,
    );

    const results = await axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    expect(results.violations).toEqual([]);
  });

  it("parses localized rupiah input as an exact integer", () => {
    const onValueChange = vi.fn();
    render(
      <RupiahInput
        id="salary"
        label="Gaji"
        value="1.500.000"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.input(screen.getByLabelText("Gaji"), { target: { value: "1.500.000" } });
    expect(onValueChange).toHaveBeenCalledWith(1_500_000n);
  });

  it("explains invalid rupiah input and clears the value", () => {
    const onValueChange = vi.fn();
    render(<RupiahInput id="salary" label="Gaji" value="1.2.3" onValueChange={onValueChange} />);
    fireEvent.input(screen.getByLabelText("Gaji"), { target: { value: "1.2.3" } });
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert").textContent).toContain("angka Rupiah utuh");
  });
});
