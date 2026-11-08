// Historical May plans are controlled fixtures for regression scenarios, not live-content evidence.
// june-beaches-check.mjs separately verifies the actual published June candidates without interception.
import {readFile} from 'node:fs/promises';
export const referencePlans=JSON.parse(await readFile(new URL('../tests/fixtures/reference-plans.json',import.meta.url),'utf8'));
export async function useReferencePlans(context){
  await context.route('**/data/site.json*',route=>route.fulfill({json:referencePlans}));
}
