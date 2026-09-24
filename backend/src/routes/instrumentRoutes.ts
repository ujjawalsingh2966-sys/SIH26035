import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { instrumentStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';

export const instrumentRoutes = Router();

instrumentRoutes.get('/', (req, res) => {
  res.json({ success: true, data: instrumentStore.findAll() });
});

instrumentRoutes.post(
  '/',
  requireRole(['Technician']),
  body('manufacturerId').notEmpty(),
  body('name').notEmpty(),
  body('model').notEmpty(),
  body('serialNumber').notEmpty(),
  body('isWeighing').isBoolean(),
  body('isManual').isBoolean(),
  body('isElectronic').isBoolean(),
  body('isSingleRange').isBoolean(),
  (req: Request, res: Response) => {
    const data = req.body;

    // NAWI Scope Validation Boundary
    if (!data.isWeighing) {
      return res.status(400).json({ success: false, error: 'Out of Scope: Candidate must be a weighing instrument' });
    }
    if (!data.isManual) {
      return res.status(400).json({ success: false, error: 'Out of Scope: Automatic Weighing Instruments (AWI) are governed by OIML R51/134' });
    }
    if (!data.isElectronic) {
      return res.status(400).json({ success: false, error: 'Out of Scope: Mechanical balances are excluded from MVP' });
    }
    if (!data.isSingleRange) {
      return res.status(400).json({ success: false, error: 'Out of Scope: Multi-range/Multi-interval deferred from MVP' });
    }

    const newInstrument = {
      id: `inst_${Date.now()}`,
      manufacturerId: data.manufacturerId,
      name: data.name,
      model: data.model,
      serialNumber: data.serialNumber,
      isWeighing: data.isWeighing,
      isManual: data.isManual,
      isElectronic: data.isElectronic,
      isSingleRange: data.isSingleRange,

      // Optional until parameters are added
      accuracyClass: data.accuracyClass,
      maxCapacity: data.maxCapacity,
      minCapacity: data.minCapacity,
      e: data.e,
      d: data.d,
      hasTare: data.hasTare
    };

    instrumentStore.saveItem(newInstrument);
    res.status(201).json({ success: true, data: newInstrument });
  }
);
