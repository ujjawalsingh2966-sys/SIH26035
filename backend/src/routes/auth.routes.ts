import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { accountStore, checkPassword, createBusinessAccount, DuplicateAccountError, normalizeEmail, publicAccount } from '../services/AccountService';
import { isKnownStaffEmail } from '../services/DevelopmentStaffIdentity';
import { publicStaff, staffStore, verifyStaffPassword } from '../services/StaffService';
import { issueSession, revokeSession } from '../services/SessionService';
import { loginLimiter } from '../middlewares/loginLimiter';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

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
    if (isKnownStaffEmail(email) || staffStore.findAll().some(item => item.email === email)) {
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
  const data = user.role === 'Business' ? publicAccount(accountStore.findById(user.id)!) : publicStaff(staffStore.findById(user.id)!);
  res.set('Cache-Control', 'no-store').json({ success: true, data });
});

router.post('/logout', authenticate, (req, res) => {
  try {
    revokeSession(req.sessionId!);
    return res.set('Cache-Control', 'no-store').json({ success: true });
  } catch { return res.status(503).json({ success: false, error: 'Sign out could not be confirmed. Please retry.' }); }
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  
  if (!email || email.length > 254 || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Validation Error: Email and password required' });
  }

  if (Object.keys(req.body).some(key => !['email', 'password'].includes(key))) return res.status(400).json({ success: false, error: 'Only email and password are accepted for sign in' });

  try {
  const account = accountStore.findAll().find(item => item.email === email);
  if (account) {
    if (account.role !== 'Business' || !account.active || typeof password !== 'string' || password.length > 128 || !checkPassword(password, account.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    const token = issueSession(account);
    return res.set('Cache-Control', 'no-store').json({ success: true, data: { token, user: publicAccount(account) } });
  }

  const staff = staffStore.findAll().find(item => item.email === email);
  const valid = await verifyStaffPassword(password, staff?.passwordHash || '');
  // Re-read after the asynchronous password check so deactivation/reset cannot
  // race login and turn stale credentials into a newly valid session.
  const current = staff && staffStore.findById(staff.id);
  if (!valid || !current?.active || current.passwordHash !== staff!.passwordHash) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }
  const token = issueSession(current);
  return res.set('Cache-Control', 'no-store').json({ success: true, data: { token, user: publicStaff(current) } });
  } catch {
    return res.status(503).json({ success: false, error: 'Sign in is temporarily unavailable. Please try again.' });
  }
});

export default router;
