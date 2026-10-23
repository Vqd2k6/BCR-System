import { runResidentialAppraisal40Cases } from './test_residential_appraisal_40_cases';

runResidentialAppraisal40Cases().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
