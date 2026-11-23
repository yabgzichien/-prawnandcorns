import type { FeeRecord } from "../world/types.ts";

// ALL FINANCE RECORDS ARE INVENTED FOR THE DEMO. Not real XMUM fees.
// Finance only lists an instalment once it has been "posted". Tuition instalment 2 starts unposted,
// so the "Finance posts an instalment" scenario event has something real to add.

export const FEE_CURRENCY = "RM";
export const FEE_TOTAL = 8700;

export const BASE_FEES: FeeRecord[] = [
  { id: "f1", description: "Tuition instalment 1", amount: 4350, due: "2026-09-15T00:00:00+08:00", status: "paid", paidOn: "2026-09-12T00:00:00+08:00", posted: true },
  { id: "f2", description: "Tuition instalment 2", amount: 4350, due: "2026-11-30T00:00:00+08:00", status: "due", posted: false },
  { id: "f3", description: "Hostel for Semester 1", amount: 1200, due: "2026-12-15T00:00:00+08:00", status: "due", posted: false },
];
