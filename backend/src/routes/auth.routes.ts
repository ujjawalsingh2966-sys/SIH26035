import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { accountStore, checkPassword, createBusinessAccount, DuplicateAccountError, normalizeEmail, publicAccount } from '../services/AccountService';
import { developmentStaffId, isKnownStaffEmail } from '../services/DevelopmentStaffIdentity';

const router = Router();

router.post('/register',
  body('email').isString().bail().trim().isEmail().withMessage('Enter a valid email address').isLength({ max: 254 }),
  body('password').isString().bail().isLength({ min: 12, max: 128 }).withMessage('Password must contain 12–128 characters'),
  body('name').isString().bail().trim().isLength({ min: 2, max: 120 }).withMessage('Name must contain 2–120 characters'),
  validateRequest,
  (req, res) => {
    if (req.body.role !== undefined && req.body.role !== 'Business') {
      return res.status(403).json({ success: false, error: 'Self-registration is limited to Business accounts' });
    }
    const email = normalizeEmail(req.body.email);
    if (isKnownStaffEmail(email)) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }
    try {
      const account = createBusinessAccount(req.body.name, email, req.body.password);
      return res.status(201).json({ success: true, data: publicAccount(account) });
    } catch (err) {
      if (err instanceof DuplicateAccountError) {
        return res.status(409).json({ success: false, error: err.message });
      }
      return res.status(503).json({ success: false, error: 'Account could not be saved. Please try again.' });
    }
  }
);

router.get('/me', authenticate, (req, res) => {
  const user = req.user!;
  const data = user.role === 'Business' ? publicAccount(accountStore.findById(user.id)!)
    : { id: user.id, email: user.email, role: user.role };
  res.set('Cache-Control', 'no-store').json({ success: true, data });
});

// TEMPORARY: Development login mechanism to support Foundation verification
// This must be replaced with proper credential handling in the fully authorized setup.
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Validation Error: Email and password required' });
  }

  const account = accountStore.findAll().find(item => item.email === email);
  if (account) {
    if (account.role !== 'Business' || !account.active || typeof password !== 'string' || password.length > 128 || !checkPassword(password, account.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: account.id, email: account.email, role: 'Business' }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '8h' });
    return res.json({ success: true, data: { token, user: publicAccount(account) } });
  }

  // Temporary mock validation
  if (password !== 'dev-demo-password') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid credentials' });
  }

  // Mapping domain roles based on mock emails
  let role = 'Technician';
  if (email.includes('reviewer')) role = 'Reviewer';
  if (email.includes('admin')) role = 'Administrator';

  // Keep the original default technician's records accessible; other demo accounts
  // need distinct stable identities so ownership and separation of duties can work.
  const id = developmentStaffId(email);

  const token = jwt.sign(
    { id, email, role },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: { id, email, role }
    }
  });
});

export default router;
