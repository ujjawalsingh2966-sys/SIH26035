import { withPersistence } from '../middlewares/withPersistence';
import { Router } from 'express';
import { requireRole } from '../middlewares/authResolver';
import { requireCurrentRevision, requireTestCaseAccess } from '../middlewares/testCaseAccess';
import { testCaseStore, nativeTestStore, observationStore } from '../repositories';
import { caseMasterData, MasterDataError } from '../services/MasterDataService';
import { buildNativeProgramme, validateProfile, instrumentFingerprint, nativePurposePolicy, nativeProgrammeIssue, requireNativeProgramme } from '../services/NativeApplicability';
import { evaluateNative, nativeFingerprint } from '../services/NativeEvaluation';
import { AuditService } from '../services/AuditService';
import { masterDataFailure } from './manufacturerRoutes';
import type { TestCase } from '../types/domain';
import type { NativeSubmission } from '../types/native';
import { assessStoredProgramme } from '../services/ProgrammeAssessment';
export const nativeRoutes = Router();
nativeRoutes.use('/:id', requireTestCaseAccess(req => req.params.id));
const writable = (testCase: TestCase, id: string) => {
  if (testCase.technicianId !== id) throw new MasterDataError('Only the owning Technician may record native tests', 403);
  if (!['DRAFT','TESTING'].includes(testCase.status)) throw new MasterDataError('Programme changes require DRAFT or TESTING', 403);
};
nativeRoutes.get('/:id', withPersistence(async (req, res) => {
  const testCase = (await testCaseStore.findById(req.params.id))!;
  const programmeError = testCase.nativeProgramme === undefined ? undefined : nativeProgrammeIssue(testCase.nativeProgramme);
  res.json({ success: true, data: { testCase, programme: programmeError ? null : testCase.nativeProgramme || null, ...(programmeError ? { programmeError } : {}),
    tests: (await nativeTestStore.findAll()).filter(item => item.testCaseId === testCase.id), assessment: (await assessStoredProgramme(testCase)) } });
}, masterDataFailure));
nativeRoutes.put('/:id/programme', requireRole(['Technician']), requireCurrentRevision, withPersistence(async (req, res) => {
  try {
    const current = (await testCaseStore.findById(req.params.id))!; writable(current, req.user!.id);
    if (current.nativeProgramme !== undefined) requireNativeProgramme(current.nativeProgramme);
    if (Object.keys(req.body).some(key => !['expectedRevision','profile','performance'].includes(key))) throw new MasterDataError('Unsupported programme request fields');
    if ((await nativeTestStore.findAll()).some(item => item.testCaseId === current.id)) throw new MasterDataError('Programme is frozen after native evidence is recorded; existing test results may not be reinterpreted', 409);
    const { instrument } = (await caseMasterData(current));
    if (!current.masterDataSnapshot || !instrument) throw new MasterDataError('A P2 frozen instrument snapshot is required; legacy records are not migrated', 409);
    if (current.nativeProgramme?.performance && req.body.performance === undefined) throw new MasterDataError('A performance programme cannot be downgraded to P3',409);
    const programme = buildNativeProgramme(instrument, validateProfile(req.body.profile), req.user!.id, req.body.performance);
    const initial = nativePurposePolicy(programme.profile.purpose).initialLimits;
    if ((await observationStore.findAll()).some(row => row.testCaseId === current.id) && (current.isInitialVerification !== false) !== initial) throw new MasterDataError('Changing the MPE context of existing observations is prohibited', 409);
    const updated = { ...current, isInitialVerification: initial, nativeProgramme: programme, revision: (current.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    (await testCaseStore.saveItem(updated, true));
    (await AuditService.recordEvent({ testCaseId: current.id, actorId: req.user!.id, actorRole: req.user!.role, action: 'NATIVE_PROGRAMME_DEFINED', metadata: { previous: current.nativeProgramme, programme } }));
    return res.json({ success: true, data: programme });
  } catch (error) { return masterDataFailure(res, error); }
}, masterDataFailure));
nativeRoutes.put('/:id/tests/:procedure/:series', requireRole(['Technician']), requireCurrentRevision, withPersistence(async (req, res) => {
  try {
    const current = (await testCaseStore.findById(req.params.id))!; writable(current, req.user!.id);
    if (current.status !== 'TESTING') throw new MasterDataError('Native observations require TESTING status', 403);
    if (Object.keys(req.body).some(key => !['expectedRevision','submission'].includes(key))) throw new MasterDataError('Unsupported test request fields');
    const programme = current.nativeProgramme, { instrument } = (await caseMasterData(current));
    if (!programme || !instrument || programme.instrumentFingerprint !== instrumentFingerprint(instrument)) throw new MasterDataError('A matching frozen programme is required', 409);
    const submission = req.body.submission as NativeSubmission;
    if (!submission || submission.procedureId !== req.params.procedure || submission.series !== req.params.series) throw new MasterDataError('Procedure/series payload does not match the request URL');
    const result = evaluateNative(programme, submission);
    const id = `${current.id}:${submission.procedureId}:${submission.series}`, previous = (await nativeTestStore.findById(id));
    const record = { id, testCaseId: current.id, programmeId: programme.id, submission: JSON.parse(JSON.stringify(submission)), result,
      createdAt: new Date().toISOString(), createdBy: req.user!.id, inputFingerprint: nativeFingerprint(programme, submission) };
    (await nativeTestStore.saveItem(record));
    (await testCaseStore.saveItem({ ...current, revision: (current.revision ?? 0) + 1, updatedAt: new Date().toISOString() }, true));
    (await AuditService.recordEvent({ testCaseId: current.id, actorId: req.user!.id, actorRole: req.user!.role, action: previous ? 'NATIVE_TEST_CORRECTED' : 'NATIVE_TEST_RECORDED', metadata: { previous, record } }));
    return res.json({ success: true, data: record });
  } catch (error) { return masterDataFailure(res, error); }
}, masterDataFailure));
