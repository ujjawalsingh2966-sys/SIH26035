import type { Request, RequestHandler, Response } from 'express';
import { unitOfWork } from '../repositories/persistence';
import { requireCurrentRevision } from './testCaseAccess';
import { resolveSession } from '../services/SessionService';

type Handler = (req: Request, res: Response) => unknown;
type Failure = (res: Response, error: Error, req: Request) => unknown;
class RejectedResponse extends Error {}

/** Buffer the terminal response until staged changes commit. Existing route error
 * bodies stay intact; an error response discards the entire staged operation. */
export function withPersistence(handler: Handler, failure?: Failure): RequestHandler {
  return (req, res, next) => {
    let response: (() => void) | undefined;
    const proxy = new Proxy(res, {
      get(target, property) {
        if (['json', 'send', 'end'].includes(String(property))) {
          return (...args: unknown[]) => {
            response = () => { (target[property as keyof Response] as Function).apply(target, args); };
            return proxy;
          };
        }
        const value = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          const result = value.apply(target, args);
          return result === target ? proxy : result;
        };
      },
    });
    return unitOfWork.write(async () => {
      // Authentication happened before entering the queue; recheck revocation and
      // active-account state after waiting, without changing the JWT contract.
      if (req.user) {
        const active = await resolveSession(req.headers.authorization!.slice(7));
        if (!active) {
          proxy.status(401).json({ success: false, error: 'Session is unavailable. Please sign in again.' });
          throw new RejectedResponse();
        }
      }
      if (req.recheckRevision) {
        let valid = false;
        let revisionError: unknown;
        await requireCurrentRevision(req, proxy, error => {
          if (error) revisionError = error;
          else valid = true;
        });
        if (revisionError) throw revisionError;
        if (!valid) throw new RejectedResponse();
      }
      await handler(req, proxy);
      if (res.statusCode >= 400) throw new RejectedResponse();
    }).then(() => { response?.(); }, error => {
      if (error instanceof RejectedResponse) { response?.(); return; }
      if (response) {
        res.removeHeader('Content-Type');
        res.removeHeader('Content-Disposition');
        if (failure) { failure(res, error as Error, req); return; }
        res.status(503).json({ success: false, error: 'Storage is unavailable. Refresh before retrying.' });
      } else next(error);
    }).catch(next);
  };
}
