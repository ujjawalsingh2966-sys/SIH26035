import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import Decimal from 'decimal.js';
import { validateRequest } from '../middlewares/validateRequest';
import {
  ApplicationHttpError,
  getOwnApplication,
  listOwnApplications,
  submitBusinessApplication,
} from '../services/BusinessApplicationService';

export const businessApplicationRoutes = Router();

const run = (handler: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(() => handler(req, res)).catch(next);
  };

const text = (field: string, max = 200) =>
  body(field).isString().bail().trim().isLength({ min: 1, max });

const decimal = (field: string, positive = false) =>
  body(field)
    .isString()
    .bail()
    .isLength({ min: 1, max: 40 })
    .bail()
    .custom(value => {
      if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Use a non-negative decimal in grams');
      const parsed = new Decimal(value);
      if (!parsed.isFinite() || (positive && !parsed.gt(0))) throw new Error('Must be positive');
      return true;
    });

const applicationShape = body().custom(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Application body is required');
  const allowedApplicationFields = new Set(['businessName', 'address', 'submissionKey', 'instrument']);
  const unexpected = Object.keys(value).filter(key => !allowedApplicationFields.has(key));
  if (unexpected.length) throw new Error('Unsupported or privileged application fields are not permitted');
  if (!value.instrument || typeof value.instrument !== 'object' || Array.isArray(value.instrument)) throw new Error('Instrument details are required');
  const allowedInstrumentFields = new Set([
    'name', 'model', 'serialNumber', 'accuracyClass', 'maxCapacity', 'minCapacity', 'e', 'd',
    'hasTare', 'isWeighing', 'isManual', 'isElectronic', 'isSingleRange',
  ]);
  if (Object.keys(value.instrument).some(key => !allowedInstrumentFields.has(key))) {
    throw new Error('Unsupported or privileged instrument fields are not permitted');
  }
  return true;
});

businessApplicationRoutes.get('/applications', run((req, res) => {
  res.json({ success: true, data: { applications: listOwnApplications(req.user!), alerts: [] } });
}));

businessApplicationRoutes.post(
  '/applications',
  applicationShape,
  body('submissionKey').isUUID(),
  text('businessName'),
  text('address', 1000),
  text('instrument.name'),
  text('instrument.model'),
  text('instrument.serialNumber'),
  body('instrument.accuracyClass').isIn(['II', 'III', 'IIII']),
  body('instrument.isWeighing').custom(value => value === true).withMessage('Instrument must be a weighing instrument'),
  body('instrument.isManual').custom(value => value === true).withMessage('Only non-automatic instruments are supported'),
  body('instrument.isElectronic').custom(value => value === true).withMessage('Only electronic instruments are supported'),
  body('instrument.isSingleRange').custom(value => value === true).withMessage('Only single-range instruments are supported'),
  body('instrument.hasTare').isBoolean({ strict: true }),
  decimal('instrument.maxCapacity', true),
  decimal('instrument.minCapacity'),
  decimal('instrument.e', true),
  decimal('instrument.d', true),
  body('instrument').custom(instrument => {
    const minimum = new Decimal(instrument.minCapacity);
    const maximum = new Decimal(instrument.maxCapacity);
    const verificationInterval = new Decimal(instrument.e);
    const scaleInterval = new Decimal(instrument.d);
    if (minimum.gte(maximum) || scaleInterval.gt(verificationInterval) || verificationInterval.gt(maximum)) {
      throw new Error('Require Min < Max and 0 < d ≤ e ≤ Max');
    }
    return true;
  }),
  validateRequest,
  run((req, res) => {
    const instrument = req.body.instrument;
    const result = submitBusinessApplication(req.user!, {
      submissionKey: req.body.submissionKey,
      businessName: req.body.businessName,
      address: req.body.address,
      instrument: {
        name: instrument.name,
        model: instrument.model,
        serialNumber: instrument.serialNumber,
        accuracyClass: instrument.accuracyClass,
        maxCapacity: instrument.maxCapacity,
        minCapacity: instrument.minCapacity,
        e: instrument.e,
        d: instrument.d,
        hasTare: instrument.hasTare,
        isWeighing: true,
        isManual: true,
        isElectronic: true,
        isSingleRange: true,
      },
    });
    res.status(result.created ? 201 : 200).json({ success: true, data: result.application });
  }),
);

businessApplicationRoutes.get('/applications/:id', run((req, res) => {
  res.json({ success: true, data: getOwnApplication(req.params.id, req.user!) });
}));

businessApplicationRoutes.put('/applications/:id', run((req, res) => {
  getOwnApplication(req.params.id, req.user!);
  throw new ApplicationHttpError(409, 'Submitted applications cannot be edited');
}));

businessApplicationRoutes.post('/applications/:id/submit', run((req, res) => {
  getOwnApplication(req.params.id, req.user!);
  throw new ApplicationHttpError(409, 'Application is already submitted');
}));
