const http = require('http');

async function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log("--- LOGIN ---");
  const login = await request('POST', '/api/v1/auth/login', { email: 'tech@demo', password: 'dev-demo-password' });
  const token = login.data.token;
  console.log("Token acquired.");

  console.log("\n--- CREATE MANUFACTURER ---");
  const mfr = await request('POST', '/api/v1/manufacturers', { name: "Sartorius", address: "Germany", identifier: "MFR-SART" }, token);
  const mfrId = mfr.data.id;
  console.log("Response:", mfr);

  console.log("\n--- INSTRUMENT INTAKE (OUT OF SCOPE) ---");
  const badInst = await request('POST', '/api/v1/instruments', {
    manufacturerId: mfrId, name: "MechBalance", model: "MB100", serialNumber: "SN001",
    isWeighing: true, isManual: true, isElectronic: false, isSingleRange: true
  }, token);
  console.log("Response:", badInst);

  console.log("\n--- INSTRUMENT INTAKE (IN SCOPE) ---");
  const goodInst = await request('POST', '/api/v1/instruments', {
    manufacturerId: mfrId, name: "Sartorius Precision", model: "PS200", serialNumber: "SN-VALID-001",
    isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
    accuracyClass: "I", maxCapacity: "200.0", minCapacity: "0.1", e: "0.01", d: "0.01", hasTare: true
  }, token);
  console.log("Response:", goodInst);
  const instId = goodInst.data.id;

  console.log("\n--- CREATE TEST CASE ---");
  const tc = await request('POST', '/api/v1/test-cases', { instrumentId: instId }, token);
  console.log("Response:", tc);
  const tcId = tc.data.id;

  console.log("\n--- LAB CONDITIONS ---");
  const lab = await request('PUT', `/api/v1/test-cases/${tcId}/laboratory-conditions`, { temperature: "20.5", humidity: "50.0", pressure: "1013" }, token);
  console.log("Response:", lab);

  console.log("\n--- RECORD OBSERVATION ---");
  const obs = await request('POST', '/api/v1/observations', {
    testCaseId: tcId, testType: "WEIGHING", sequence: 1, load: "0.500", indication: "0.4999998", additionalWeights: "0.0000001"
  }, token);
  console.log("Response:", obs);

  console.log("\n--- SUBMIT FOR REVIEW ---");
  const submit = await request('PUT', `/api/v1/test-cases/${tcId}/status`, { status: "SUBMITTED_FOR_REVIEW" }, token);
  console.log("Response:", submit);

  console.log("\n--- RECORD OBSERVATION ON LOCKED TC ---");
  const lockedObs = await request('POST', '/api/v1/observations', {
    testCaseId: tcId, testType: "WEIGHING", sequence: 2, load: "1", indication: "1.0", additionalWeights: "0"
  }, token);
  console.log("Response:", lockedObs);
}

runTests().catch(console.error);
