import { getNodeByKey } from '../data/customUnitDefinitions.js';
import { CUSTOM_MAX_POWER } from './customUnitConstants.js';

/**
 * @param {string[]} selectedKeys
 * @returns {{ totalPower: number, maxPower: number, isOverBudget: boolean }}
 */
export function computePowerBudget(selectedKeys) {
  let totalPower = 0;
  for (const k of selectedKeys || []) {
    const node = getNodeByKey(String(k).trim());
    totalPower += Number(node?.powerCost ?? 1);
  }
  return {
    totalPower,
    maxPower: CUSTOM_MAX_POWER,
    isOverBudget: totalPower > CUSTOM_MAX_POWER
  };
}
