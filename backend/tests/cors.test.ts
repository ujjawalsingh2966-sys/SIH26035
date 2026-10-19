import request from 'supertest';
import app from '../src/app';

describe('development frontend origin allowlist', () => {
  it('permits the current local W8LAB frontend origin', async () => {
    const response = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://127.0.0.1:3014')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3014');
  });

  it('does not add an allow-origin header for an untrusted origin', async () => {
    const response = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
