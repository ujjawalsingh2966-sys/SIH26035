import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

const router = Router();

// TEMPORARY: Development login mechanism to support Foundation verification
// This must be replaced with proper credential handling in the fully authorized setup.
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Validation Error: Email and password required' });
  }

  // Temporary mock validation
  if (password !== 'dev-demo-password') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid credentials' });
  }

  // Mapping domain roles based on mock emails
  let role = 'Technician';
  if (email.includes('reviewer')) role = 'Reviewer';
  if (email.includes('admin')) role = 'Administrator';

  const token = jwt.sign(
    { id: 'dev-user-01', email, role },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: { email, role }
    }
  });
});

export default router;
