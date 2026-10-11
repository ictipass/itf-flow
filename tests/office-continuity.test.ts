import assert from "node:assert/strict";
import test from "node:test";
import { AvailabilityStatus, Classification, User, UserRole } from "../lib/generated/prisma/client";
import { isCurrentlyAvailable, selectContinuityCandidate } from "../lib/office-continuity";

function user(id: string, role = UserRole.DIVISION_HEAD): User {
  return { id, role, isActive: true } as User;
}

test("availability defaults safely to available and respects an active absence", () => {
  assert.equal(isCurrentlyAvailable(null), true);
  assert.equal(isCurrentlyAvailable({ status: AvailabilityStatus.UNAVAILABLE, unavailableUntil: null }), false);
  assert.equal(isCurrentlyAvailable({ status: AvailabilityStatus.UNAVAILABLE, unavailableUntil: new Date("2026-01-01") }, new Date("2026-01-02")), true);
});

test("continuity selects the first available eligible successor", () => {
  const selected = selectContinuityCandidate({
    classification: Classification.INTERNAL,
    requireApproval: false,
    candidates: [
      { user: user("first"), rank: 1, canApprove: false, status: AvailabilityStatus.UNAVAILABLE },
      { user: user("second"), rank: 2, canApprove: false, status: AvailabilityStatus.AVAILABLE },
    ],
  });
  assert.equal(selected?.user.id, "second");
  assert.equal(selected?.rank, 2);
});

test("approval routing skips a successor without an explicit approval grant", () => {
  const selected = selectContinuityCandidate({
    classification: Classification.INTERNAL,
    requireApproval: true,
    candidates: [
      { user: user("first"), rank: 1, canApprove: false, status: AvailabilityStatus.AVAILABLE },
      { user: user("second"), rank: 2, canApprove: true, status: AvailabilityStatus.AVAILABLE },
    ],
  });
  assert.equal(selected?.user.id, "second");
});

test("continuity fails closed when no successor is eligible", () => {
  const selected = selectContinuityCandidate({
    classification: Classification.INTERNAL,
    requireApproval: false,
    candidates: [
      { user: { ...user("inactive"), isActive: false }, rank: 1, canApprove: true, status: AvailabilityStatus.AVAILABLE },
      { user: user("away"), rank: 2, canApprove: true, status: AvailabilityStatus.UNAVAILABLE },
    ],
  });
  assert.equal(selected, null);
});
