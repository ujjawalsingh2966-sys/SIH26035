import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import Decimal from "decimal.js";
import QRCode from "qrcode";
import { config } from "../config/env";
import { authenticate } from "../middlewares/authResolver";
import { validateRequest } from "../middlewares/validateRequest";
import {
  applicationStore,
  canRead,
  getApplication,
  submitApplication,
  assignApplication,
  inspectApplication,
  issueCertificate,
  rejectApplication,
  publicCertificate,
} from "../services/VerificationService";

export const verificationRoutes = Router();
const run =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  };
const text = (field: string, max = 200) =>
  body(field).isString().trim().isLength({ min: 1, max });
const decimal = (field: string, positive = false) =>
  body(field)
    .isString()
    .isLength({ min: 1, max: 40 })
    .custom((value) => {
      if (!/^\d+(\.\d+)?$/.test(value))
        throw new Error("Use a non-negative decimal in grams");
      const number = new Decimal(value);
      if (!number.isFinite() || (positive && !number.gt(0)))
        throw new Error("Must be positive");
      return true;
    });
verificationRoutes.get(
  "/public/certificates/:token",
  run((req, res) =>
    res.json({ success: true, data: publicCertificate(req.params.token) }),
  ),
);
verificationRoutes.use(authenticate);
verificationRoutes.get(
  "/applications",
  run((req, res) => {
    const applications = applicationStore
      .findAll()
      .filter((a) => canRead(a, req.user!))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const now = Date.now();
    const alerts = applications
      .filter(
        (a) =>
          a.certificate &&
          Date.parse(a.certificate.validUntil) <= now + 30 * 86400000,
      )
      .map((a) => ({
        applicationId: a.id,
        instrumentName: a.instrument.name,
        validUntil: a.certificate!.validUntil,
        expired: Date.parse(a.certificate!.validUntil) <= now,
      }));
    res.json({ success: true, data: { applications, alerts } });
  }),
);
verificationRoutes.post(
  "/applications",
  text("businessName"),
  text("address", 1000),
  body("previousApplicationId").optional().isUUID(),
  text("instrument.name"),
  text("instrument.model"),
  text("instrument.serialNumber"),
  body("instrument.accuracyClass").isIn(["II", "III", "IIII"]),
  body("instrument.isWeighing").equals("true"),
  body("instrument.isManual").equals("true"),
  body("instrument.isElectronic").equals("true"),
  body("instrument.isSingleRange").equals("true"),
  body("instrument.hasTare").isBoolean(),
  decimal("instrument.maxCapacity", true),
  decimal("instrument.minCapacity"),
  decimal("instrument.e", true),
  decimal("instrument.d", true),
  body("instrument").custom((i) => {
    if (
      new Decimal(i.minCapacity).gte(i.maxCapacity) ||
      new Decimal(i.d).gt(i.e) ||
      new Decimal(i.e).gt(i.maxCapacity)
    )
      throw new Error("Require Min < Max and 0 < d ≤ e ≤ Max");
    return true;
  }),
  validateRequest,
  run((req, res) => {
    const i = req.body.instrument;
    const instrument = {
      id: "",
      manufacturerId: "",
      name: i.name,
      model: i.model,
      serialNumber: i.serialNumber,
      accuracyClass: i.accuracyClass,
      maxCapacity: i.maxCapacity,
      minCapacity: i.minCapacity,
      e: i.e,
      d: i.d,
      hasTare: i.hasTare === true || i.hasTare === "true",
      isWeighing: true,
      isManual: true,
      isElectronic: true,
      isSingleRange: true,
    };
    res
      .status(201)
      .json({
        success: true,
        data: submitApplication(req.user!, {
          businessName: req.body.businessName,
          address: req.body.address,
          instrument,
          previousApplicationId: req.body.previousApplicationId,
        }),
      });
  }),
);
verificationRoutes.get(
  "/applications/:id",
  run((req, res) =>
    res.json({ success: true, data: getApplication(req.params.id, req.user!) }),
  ),
);
verificationRoutes.post(
  "/applications/:id/assign",
  body("officerId").isUUID(),
  body("scheduledAt").isISO8601(),
  validateRequest,
  run((req, res) =>
    res.json({
      success: true,
      data: assignApplication(
        req.params.id,
        req.user!,
        req.body.officerId,
        req.body.scheduledAt,
      ),
    }),
  ),
);
verificationRoutes.post(
  "/applications/:id/inspect",
  text("notes", 4000),
  body("observations").isArray({ min: 1, max: 100 }),
  body("observations.*.testType").isIn(["WEIGHING", "ECCENTRICITY", "TARE"]),
  decimal("observations.*.load"),
  decimal("observations.*.indication"),
  decimal("observations.*.additionalWeights"),
  body("observations.*.zeroError")
    .optional()
    .isString()
    .matches(/^-?\d+(\.\d+)?$/)
    .isLength({ max: 40 }),
  validateRequest,
  run((req, res) =>
    res.json({
      success: true,
      data: inspectApplication(
        req.params.id,
        req.user!,
        req.body.notes,
        req.body.observations.map((o: any) => ({
          testType: o.testType,
          load: o.load,
          indication: o.indication,
          additionalWeights: o.additionalWeights,
          zeroError: o.zeroError || "0",
        })),
      ),
    }),
  ),
);
verificationRoutes.post(
  "/applications/:id/certify",
  body("validUntil").isISO8601(),
  validateRequest,
  run((req, res) =>
    res.json({
      success: true,
      data: issueCertificate(req.params.id, req.user!, req.body.validUntil),
    }),
  ),
);
verificationRoutes.post(
  "/applications/:id/reject",
  text("reason", 2000),
  validateRequest,
  run((req, res) =>
    res.json({
      success: true,
      data: rejectApplication(req.params.id, req.user!, req.body.reason),
    }),
  ),
);
verificationRoutes.get(
  "/applications/:id/certificate",
  run(async (req, res) => {
    const a = getApplication(req.params.id, req.user!);
    if (!a.certificate)
      return res
        .status(404)
        .json({ success: false, error: "Certificate not issued" });
    const verificationUrl = `${config.publicWebUrl.replace(/\/$/, "")}/verify/${a.certificate.publicToken}`;
    res.json({
      success: true,
      data: {
        ...publicCertificate(a.certificate.publicToken),
        verificationUrl,
        qrDataUrl: await QRCode.toDataURL(verificationUrl, {
          width: 240,
          margin: 2,
        }),
      },
    });
  }),
);
