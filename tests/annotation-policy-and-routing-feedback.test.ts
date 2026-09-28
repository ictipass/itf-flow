import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../lib/generated/prisma/client";
import { annotationStrongAuthenticationRequired } from "../lib/annotation-policy";
import { label } from "../lib/reference";
import { routingFeedbackMessage } from "../lib/routing-feedback";

const enforced = {
  annotationMfaRequiredForDg: true,
  annotationMfaRequiredForDirectors: true,
  annotationMfaRequiredForDivisionHeads: true,
};

test("annotation authentication defaults can be relaxed independently for the three governed roles", () => {
  assert.equal(annotationStrongAuthenticationRequired(UserRole.DG, enforced), true);
  assert.equal(annotationStrongAuthenticationRequired(UserRole.DIRECTOR, { ...enforced, annotationMfaRequiredForDirectors: false }), false);
  assert.equal(annotationStrongAuthenticationRequired(UserRole.DIVISION_HEAD, { ...enforced, annotationMfaRequiredForDivisionHeads: false }), false);
  assert.equal(annotationStrongAuthenticationRequired(UserRole.OFFICER, { ...enforced, annotationMfaRequiredForDg: false }), true);
});

test("role labels preserve the DG acronym", () => {
  assert.equal(label("DG"), "DG");
  assert.equal(label("DG_SECRETARY"), "DG Secretary");
  assert.equal(label("DIVISION_HEAD"), "Division Head");
});

test("known routing validation failures are safe for toast feedback", () => {
  const messages = [
    "Give a classification reason of at least 10 characters.",
    "Assign an active Department Secretary for Administration & Human Resource Management Department before routing.",
    "Confidential and Secret routing cannot include copy recipients.",
    "Enter a minute or annotate the current document before routing.",
  ];
  for (const message of messages) assert.equal(routingFeedbackMessage(new Error(message)), message);
  assert.equal(routingFeedbackMessage(new Error("database password is secret")), null);
});
