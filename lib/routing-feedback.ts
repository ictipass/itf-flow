const safeRoutingErrors = new Set([
  "A minute and at least one action recipient are required.",
  "Enter a minute or annotate the current document before routing.",
  "You do not hold current authority to route this correspondence.",
  "Acknowledge receipt before routing this correspondence.",
  "Invalid routing request.",
  "Give a classification reason of at least 10 characters.",
  "Confidential and Secret routing cannot include copy recipients.",
  "The DG must route Confidential or Secret correspondence to a Director.",
  "Only the DG or a Director may raise Public or Internal correspondence to Confidential during routing.",
  "Routing must follow an authorized hierarchy or peer-referral path.",
  "Peer referral is disabled by the correspondence workflow policy.",
  "A peer referral requires a clear purpose of at least 10 characters.",
  "A review, concurrence, or approval request requires a clear purpose of at least 10 characters.",
  "Select exactly one decision recipient. Additional staff may be copied.",
]);

export function routingFeedbackMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (safeRoutingErrors.has(message) || /^Assign an active Department Secretary for .+ before routing\.$/.test(message)) return message;
  return null;
}
