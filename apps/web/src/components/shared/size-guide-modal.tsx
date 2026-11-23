"use client";

import { Info, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";

interface SizeGuideModalProps {
  open: boolean;
  onClose: () => void;
  selectedSize?: number | null;
}

const SIZE_CHART = [
  { eu: 38, cm: "24.0 cm", uk: "5.0", us: "6.0", fit: "Exact Standard" },
  { eu: 39, cm: "24.5 cm", uk: "6.0", us: "6.5", fit: "Exact Standard" },
  { eu: 40, cm: "25.0 cm", uk: "6.5", us: "7.0", fit: "Exact Standard" },
  { eu: 41, cm: "25.7 cm", uk: "7.5", us: "8.0", fit: "Exact Standard" },
  { eu: 42, cm: "26.3 cm", uk: "8.0", us: "8.5", fit: "Most Popular (Addis Avg)" },
  { eu: 43, cm: "27.0 cm", uk: "9.0", us: "9.5", fit: "Exact Standard" },
  { eu: 44, cm: "27.7 cm", uk: "10.0", us: "10.5", fit: "Exact Standard" },
  { eu: 45, cm: "28.4 cm", uk: "10.5", us: "11.5", fit: "Limited Stock" },
  { eu: 46, cm: "29.1 cm", uk: "11.5", us: "12.5", fit: "Limited Stock" },
];

export function SizeGuideModal({ open, onClose, selectedSize }: SizeGuideModalProps) {
  return (
    <ModalDialog open={open} onClose={onClose}>
      <div className="mb-4 flex items-center gap-3 pr-8">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Ruler className="size-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">
            Footwear Sizing Conversion &amp; Guide
          </h3>
          <p className="text-xs text-muted-foreground">
            Calibrated for Ethiopian &amp; international Continental EU shoe standards.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-low/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container font-label text-xs font-bold uppercase text-primary">
            <tr>
              <th className="px-3.5 py-2.5">EU Size</th>
              <th className="px-3.5 py-2.5">Foot Length</th>
              <th className="px-3.5 py-2.5">UK</th>
              <th className="px-3.5 py-2.5">US Men</th>
              <th className="px-3.5 py-2.5">AddisGebeya Fit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {SIZE_CHART.map((row) => {
              const isSelected = selectedSize === row.eu;
              return (
                <tr
                  key={row.eu}
                  className={isSelected ? "bg-primary-light font-semibold text-primary" : ""}
                >
                  <td className="px-3.5 py-2.5 font-bold">
                    {row.eu} {isSelected ? "(Selected)" : ""}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-xs">{row.cm}</td>
                  <td className="px-3.5 py-2.5">{row.uk}</td>
                  <td className="px-3.5 py-2.5">{row.us}</td>
                  <td className="px-3.5 py-2.5 text-xs font-semibold text-primary">{row.fit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl bg-surface-container p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-bold text-foreground">Need help trying on?</p>
          <p className="mt-0.5">
            Our Bole courier service can deliver an adjacent EU shoe size at no additional cost. For more information or to arrange your delivery, please contact us at **09xxxxxxxx**.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={onClose}>
          Understood, Continue Shopping
        </Button>
      </div>
    </ModalDialog>
  );
}

