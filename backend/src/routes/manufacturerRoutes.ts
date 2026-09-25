import { Router } from 'express';
import { body } from 'express-validator';
import { manufacturerStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';

export const manufacturerRoutes = Router();

manufacturerRoutes.get('/', (req, res) => {
  res.json({ success: true, data: manufacturerStore.findAll() });
});

manufacturerRoutes.post(
  '/',
  requireRole(['Technician', 'Administrator']),
  body('name').notEmpty().withMessage('Manufacturer name is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('identifier').notEmpty().withMessage('Identifier is required'),
  validateRequest,
  (req, res) => {
    const { name, address, identifier } = req.body;
    const newManufacturer = {
      id: `mfr_${Date.now()}`,
      name,
      address,
      identifier
    };

    manufacturerStore.saveItem(newManufacturer);
    res.status(201).json({ success: true, data: newManufacturer });
  }
);
