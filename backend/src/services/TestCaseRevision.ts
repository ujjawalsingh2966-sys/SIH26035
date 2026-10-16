import { testCaseStore } from '../repositories';
import { TestCase } from '../types/domain';

export function touchTestCase(testCase: TestCase) {
  testCase.revision = (testCase.revision ?? 0) + 1;
  testCase.updatedAt = new Date().toISOString();
  testCaseStore.saveItem(testCase);
}
