import { unitOfWork } from '../repositories/persistence';
import { testCaseStore } from '../repositories';
import { TestCase } from '../types/domain';

export async function touchTestCase(testCase: TestCase) {
  return unitOfWork.write(async () => {
    testCase.revision = (testCase.revision ?? 0) + 1;
    testCase.updatedAt = new Date().toISOString();
    (await testCaseStore.saveItem(testCase));
  });
}
