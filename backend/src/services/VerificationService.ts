import { randomUUID, randomBytes } from "crypto";
import Decimal from "decimal.js";
import { ScopedJsonStore } from "../repositories/ScopedJsonStore";
import { Instrument, ObservationEvaluation } from "../types/domain";
import { EvaluationService, RawObservationInput } from "./EvaluationService";
import { accountStore } from "./AccountService";

export type ApplicationStatus =
  | "SUBMITTED"
  | "SCHEDULED"
  | "INSPECTED"
  | "CERTIFIED"
  | "REJECTED";
export interface Actor {
  id: string;
  role: string;
}
export interface Inspection {
  notes: string;
  observedAt: string;
  officerId: string;
  observations: (RawObservationInput & { evaluation: ObservationEvaluation })[];
}
export interface Certificate {
  id: string;
  publicToken: string;
  issuedAt: string;
  validUntil: string;
  issuedBy: string;
  disclaimer: string;
}
export interface VerificationApplication {
  id: string;
  ownerId: string;
  businessName: string;
  address: string;
  instrument: Instrument;
  type: "INITIAL" | "REVERIFICATION";
  previousApplicationId?: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  officerId?: string;
  scheduledAt?: string;
  inspection?: Inspection;
  certificate?: Certificate;
  rejectionReason?: string;
  history: { action: string; actorId: string; at: string; note?: string }[];
}
export const applicationStore = new ScopedJsonStore<VerificationApplication>(
  "applications.json",
);
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const requireCondition: (
  value: unknown,
  status: number,
  message: string,
) => asserts value = (value, status, message) => {
  if (!value) throw new HttpError(status, message);
};
export function canRead(a: VerificationApplication, actor: Actor) {
  return (
    actor.role === "Administrator" ||
    a.ownerId === actor.id ||
    a.officerId === actor.id
  );
}
export function getApplication(id: string, actor: Actor) {
  const a = applicationStore.findById(id);
  requireCondition(a && canRead(a, actor), 404, "Application not found");
  return a;
}
function save(
  a: VerificationApplication,
  actor: Actor,
  action: string,
  note?: string,
) {
  a.updatedAt = new Date().toISOString();
  a.history.push({
    action,
    actorId: actor.id,
    at: a.updatedAt,
    ...(note ? { note } : {}),
  });
  return applicationStore.saveItem(a);
}
export function submitApplication(
  actor: Actor,
  input: {
    businessName: string;
    address: string;
    instrument: Instrument;
    previousApplicationId?: string;
  },
) {
  requireCondition(actor.role === "Business", 403, "Only businesses can apply");
  const previous = input.previousApplicationId
    ? getApplication(input.previousApplicationId, actor)
    : undefined;
  if (previous) {
    requireCondition(
      previous.ownerId === actor.id && previous.status === "CERTIFIED",
      409,
      "Re-verification requires your previously certified application",
    );
    requireCondition(
      !applicationStore
        .findAll()
        .some(
          (a) =>
            a.previousApplicationId === previous.id && a.status !== "REJECTED",
        ),
      409,
      "A re-verification already exists for this certificate",
    );
  }
  const now = new Date().toISOString();
  const a: VerificationApplication = {
    id: randomUUID(),
    ownerId: actor.id,
    businessName: input.businessName,
    address: input.address,
    instrument: previous
      ? structuredClone(previous.instrument)
      : { ...input.instrument, id: randomUUID(), manufacturerId: "" },
    type: previous ? "REVERIFICATION" : "INITIAL",
    ...(previous ? { previousApplicationId: previous.id } : {}),
    status: "SUBMITTED",
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  return save(a, actor, "SUBMITTED");
}
export function assignApplication(
  id: string,
  actor: Actor,
  officerId: string,
  scheduledAt: string,
) {
  requireCondition(
    actor.role === "Administrator",
    403,
    "Only administrators can schedule",
  );
  const a = getApplication(id, actor);
  requireCondition(
    ["SUBMITTED", "SCHEDULED"].includes(a.status),
    409,
    "This application cannot be scheduled",
  );
  const officer = accountStore.findById(officerId);
  requireCondition(
    officer?.active && ["LMO", "GATC"].includes(officer.role),
    400,
    "Select an active LMO or GATC account",
  );
  requireCondition(
    Date.parse(scheduledAt) > Date.now(),
    400,
    "Choose a future appointment",
  );
  a.officerId = officerId;
  a.scheduledAt = new Date(scheduledAt).toISOString();
  a.status = "SCHEDULED";
  return save(a, actor, "SCHEDULED", `${officerId}: ${a.scheduledAt}`);
}
export function inspectApplication(
  id: string,
  actor: Actor,
  notes: string,
  observations: RawObservationInput[],
) {
  const a = getApplication(id, actor);
  requireCondition(
    ["LMO", "GATC"].includes(actor.role) && a.officerId === actor.id,
    403,
    "Only the assigned officer can inspect",
  );
  requireCondition(
    a.status === "SCHEDULED",
    409,
    "Application must be scheduled before inspection",
  );
  const required = [
    "WEIGHING",
    "ECCENTRICITY",
    ...(a.instrument.hasTare ? ["TARE"] : []),
  ];
  requireCondition(
    required.every((type) => observations.some((o) => o.testType === type)),
    400,
    `Record at least one observation for: ${required.join(", ")}`,
  );
  requireCondition(
    observations.every((o) =>
      new Decimal(o.load).lte(a.instrument.maxCapacity!),
    ),
    400,
    "Applied load cannot exceed instrument capacity",
  );
  requireCondition(
    observations.every((o) => o.testType !== "TARE" || a.instrument.hasTare),
    400,
    "This instrument has no tare function",
  );
  const evaluated = observations.map((o) => ({
    ...o,
    unit: "g" as const,
    evaluation: EvaluationService.evaluateObservation(
      a.instrument,
      { ...o, unit: "g" },
      true,
    ),
  }));
  // Re-verification is not assumed to be an in-service inspection. Both use the
  // existing verification profile until a reviewed jurisdiction policy is supplied.
  a.inspection = {
    notes,
    officerId: actor.id,
    observedAt: new Date().toISOString(),
    observations: evaluated,
  };
  a.status = "INSPECTED";
  return save(a, actor, "INSPECTED");
}
export function issueCertificate(id: string, actor: Actor, validUntil: string) {
  const a = getApplication(id, actor);
  requireCondition(
    ["LMO", "GATC"].includes(actor.role) && a.officerId === actor.id,
    403,
    "Only the assigned officer can issue",
  );
  requireCondition(
    a.status === "INSPECTED" && a.inspection,
    409,
    "A completed inspection is required",
  );
  requireCondition(
    a.inspection.observations.length &&
      a.inspection.observations.every(
        (o) => o.evaluation.compliance.verdict === "PASS",
      ),
    409,
    "All recorded observations must pass; failed, blocked or inconclusive results cannot be certified",
  );
  requireCondition(
    Date.parse(validUntil) > Date.now(),
    400,
    "Validity must end in the future",
  );
  a.certificate = {
    id: `W8-${randomUUID()}`,
    publicToken: randomBytes(24).toString("hex"),
    issuedAt: new Date().toISOString(),
    validUntil: new Date(validUntil).toISOString(),
    issuedBy: actor.id,
    disclaimer:
      "PROTOTYPE — not a statutory verification certificate. Limited NAWI test profile; validity entered by the officer.",
  };
  a.status = "CERTIFIED";
  return save(a, actor, "CERTIFIED");
}
export function rejectApplication(id: string, actor: Actor, reason: string) {
  const a = getApplication(id, actor);
  requireCondition(
    ["LMO", "GATC"].includes(actor.role) && a.officerId === actor.id,
    403,
    "Only the assigned officer can reject",
  );
  requireCondition(
    ["SCHEDULED", "INSPECTED"].includes(a.status),
    409,
    "Application cannot be rejected in this state",
  );
  a.status = "REJECTED";
  a.rejectionReason = reason;
  return save(a, actor, "REJECTED", reason);
}
export function publicCertificate(token: string) {
  const a = applicationStore
    .findAll()
    .find((a) => a.certificate?.publicToken === token);
  requireCondition(a?.certificate, 404, "Certificate not found");
  const c = a.certificate;
  // Public lookup deliberately excludes owner details, address, observations and audit history.
  return {
    id: c.id,
    status: Date.parse(c.validUntil) <= Date.now() ? "EXPIRED" : "VALID",
    instrumentName: a.instrument.name,
    model: a.instrument.model,
    serialNumber: a.instrument.serialNumber,
    issuedAt: c.issuedAt,
    validUntil: c.validUntil,
    disclaimer: c.disclaimer,
  };
}
