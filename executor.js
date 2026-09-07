/**
 * executor.js — Executes a plan against the tools registry.
 *
 * The executor is the only place that actually calls a tool. It never
 * fabricates a result: whatever the tool returns (success / failure /
 * unavailable) is what gets reported upward, unmodified in meaning.
 */

import { tools } from './tools.js';

export const executor = {
  /**
   * @param {object} plan - output of planner.plan()
   * @param {(status: string) => void} onActivity - called with short status strings
   * @returns {Promise<{status: string, message: string, data?: any}>}
   */
  async execute(plan, onActivity = () => {}) {
    if (plan.type === 'conversation') {
      return { status: 'success', message: 'conversation', data: { text: plan.params.text } };
    }

    if (plan.type === 'unsupported_action') {
      onActivity('Unavailable');
      return { status: 'unavailable', message: plan.reason || 'This action is not supported yet.' };
    }

    if (!plan.tool || !tools[plan.tool]) {
      onActivity('Unavailable');
      return { status: 'unavailable', message: `No tool registered for "${plan.type}".` };
    }

    onActivity(`Executing: ${tools[plan.tool].description || plan.tool}`);
    try {
      const result = await tools[plan.tool].run(plan.params || {});
      onActivity(result.status === 'success' ? 'Completed' : result.status === 'unavailable' ? 'Unavailable' : 'Failed');
      return result;
    } catch (err) {
      onActivity('Failed');
      return { status: 'failure', message: err && err.message ? err.message : 'Tool execution threw an error.' };
    }
  },
};
