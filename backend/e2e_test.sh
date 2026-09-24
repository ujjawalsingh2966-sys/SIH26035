#!/bin/bash

# 1. Login
echo "--- LOGIN ---"
LOGIN_RES=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"tech@demo","password":"dev-demo-password"}' http://127.0.0.1:4000/api/v1/auth/login)
TOKEN=$(echo $LOGIN_RES | jq -r '.data.token')
echo "Token: $TOKEN"

# 2. Manufacturer
echo "\n--- CREATE MANUFACTURER ---"
MFR_RES=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Sartorius","address":"Germany","identifier":"MFR-SART"}' http://127.0.0.1:4000/api/v1/manufacturers)
MFR_ID=$(echo $MFR_RES | jq -r '.data.id')
echo "MFR_ID: $MFR_ID"

# 3. Instrument (Out of Scope - Mechanical)
echo "\n--- INSTRUMENT INTAKE (OUT OF SCOPE) ---"
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{
  \"manufacturerId\":\"$MFR_ID\",
  \"name\":\"MechBalance\",
  \"model\":\"MB100\",
  \"serialNumber\":\"SN001\",
  \"isWeighing\":true,
  \"isManual\":true,
  \"isElectronic\":false,
  \"isSingleRange\":true
}" http://127.0.0.1:4000/api/v1/instruments | jq .

# 4. Instrument (In Scope)
echo "\n--- INSTRUMENT INTAKE (IN SCOPE) ---"
INST_RES=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{
  \"manufacturerId\":\"$MFR_ID\",
  \"name\":\"Sartorius Precision\",
  \"model\":\"PS200\",
  \"serialNumber\":\"SN-VALID-001\",
  \"isWeighing\":true,
  \"isManual\":true,
  \"isElectronic\":true,
  \"isSingleRange\":true,
  \"accuracyClass\":\"I\",
  \"maxCapacity\":\"200g\",
  \"e\":\"1mg\",
  \"d\":\"1mg\",
  \"hasTare\":true
}" http://127.0.0.1:4000/api/v1/instruments)
echo $INST_RES | jq .
INST_ID=$(echo $INST_RES | jq -r '.data.id')

# 5. Create Test Case
echo "\n--- CREATE TEST CASE ---"
TC_RES=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"instrumentId\":\"$INST_ID\"}" http://127.0.0.1:4000/api/v1/test-cases)
echo $TC_RES | jq .
TC_ID=$(echo $TC_RES | jq -r '.data.id')

# 6. Add Lab Conditions
echo "\n--- LAB CONDITIONS ---"
curl -s -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"temperature":"20.5","humidity":"50.0","pressure":"1013"}' http://127.0.0.1:4000/api/v1/test-cases/$TC_ID/laboratory-conditions | jq .

# 7. Record Observation (Floating point preserved strictly as string)
echo "\n--- RECORD OBSERVATION ---"
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{
  \"testCaseId\":\"$TC_ID\",
  \"testType\":\"WEIGHING\",
  \"sequence\":1,
  \"load\":\"0.5\",
  \"indication\":\"0.4999998\",
  \"additionalWeights\":\"0.0000001\"
}" http://127.0.0.1:4000/api/v1/observations | jq .

# 8. Submit Test Case for Review
echo "\n--- SUBMIT FOR REVIEW ---"
curl -s -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"status":"SUBMITTED_FOR_REVIEW"}' http://127.0.0.1:4000/api/v1/test-cases/$TC_ID/status | jq .

# 9. Try recording on submitted test case (should fail)
echo "\n--- RECORD OBSERVATION ON LOCKEED TC ---"
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{
  \"testCaseId\":\"$TC_ID\",
  \"testType\":\"WEIGHING\",
  \"sequence\":2,
  \"load\":\"1\",
  \"indication\":\"1.0000000\",
  \"additionalWeights\":\"0\"
}" http://127.0.0.1:4000/api/v1/observations | jq .

