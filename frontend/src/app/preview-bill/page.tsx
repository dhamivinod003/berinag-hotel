"use client";
import { BillFormula } from "@/components/ui/BillFormula";
export default function BillFormulaPreview() {
  return (
    <div className="min-h-screen bg-cream-50 px-6 py-16">
      <div className="mx-auto max-w-xl space-y-6">
        <BillFormula
          nightlyRate={1250000}
          nights={3}
          roomCount={1}
          subtotal={3750000}
          discount={500000}
          taxAmount={390000}
          totalAmount={3640000}
          amountPaid={1000000}
          amountDue={2640000}
          roomLabel="Himalayan View Suite"
          offerLabel="EARLY20"
        />
        <BillFormula
          nightlyRate={4500000}
          nights={2}
          roomCount={1}
          subtotal={9000000}
          discount={0}
          taxAmount={1080000}
          totalAmount={10080000}
          amountPaid={0}
          amountDue={10080000}
          roomLabel="Ocean Horizon Suite"
        />
        <BillFormula
          nightlyRate={3250000}
          nights={4}
          roomCount={2}
          subtotal={26000000}
          discount={2000000}
          taxAmount={2880000}
          totalAmount={26880000}
          amountPaid={26880000}
          amountDue={0}
          roomLabel="Stargazer Suite"
          offerLabel="LONGSTAY"
        />
      </div>
    </div>
  );
}

