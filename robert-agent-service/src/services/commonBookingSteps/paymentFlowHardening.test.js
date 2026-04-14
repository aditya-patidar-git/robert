import test from 'node:test';
import assert from 'node:assert/strict';

import { extractAvailableBalanceFromText } from '../browser/stepExecutor/stepExecutors/processPayment.js';
import { buildPaymentRequestPageNotReadyResult } from './sendPaymentRequest.js';

// =========================================================================
// 1. Balance detection: positive credit wording
// =========================================================================

test('detects "Available balance: £42.50" as credit', () => {
  const r = extractAvailableBalanceFromText('Order summary\nAvailable balance: £42.50\nTotal due: £10.00');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 42.5);
  assert.match(r.evidenceLine, /available balance/i);
});

test('detects "Account credit £15.00" as credit', () => {
  const r = extractAvailableBalanceFromText('Account credit £15.00');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 15);
});

test('detects "Credit balance: £100.00" as credit', () => {
  const r = extractAvailableBalanceFromText('Client info\nCredit balance: £100.00');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 100);
});

test('detects "Credit on account £5.50" as credit', () => {
  const r = extractAvailableBalanceFromText('Credit on account £5.50\nSome other line');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 5.5);
});

test('detects "Unapplied credit £20.00" as credit', () => {
  const r = extractAvailableBalanceFromText('Unapplied credit £20.00');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 20);
});

test('detects "Credit available" with amount on next line', () => {
  const r = extractAvailableBalanceFromText('Credit available\n£33.00');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 33);
});

test('detects "Available credit £8.99"', () => {
  const r = extractAvailableBalanceFromText('Available credit £8.99');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 8.99);
});

test('detects "Overpayment credit £12.00"', () => {
  const r = extractAvailableBalanceFromText('Overpayment credit £12.00');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 12);
});

test('detects "On account credit £7.50"', () => {
  const r = extractAvailableBalanceFromText('On account credit £7.50');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 7.5);
});

test('detects "Balance £170.00 in credit" (CRM financial summary)', () => {
  const text = 'Financial summary\nMoney owed £839.00 (including this booking)\nMoney paid £1,009.00\nBalance £170.00 in credit';
  const r = extractAvailableBalanceFromText(text);
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 170);
});

test('detects "Balance £25.50 in credit" on single line', () => {
  const r = extractAvailableBalanceFromText('Balance £25.50 in credit');
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 25.5);
});

// =========================================================================
// 2. Balance detection: non-credit wording must NOT trigger
// =========================================================================

test('ignores "Balance due: £42.50"', () => {
  const r = extractAvailableBalanceFromText('Payment details\nBalance due: £42.50\nGrand total: £42.50');
  assert.equal(r.hasAvailableBalance, false);
});

test('ignores "Amount due: £10.00"', () => {
  const r = extractAvailableBalanceFromText('Amount due: £10.00');
  assert.equal(r.hasAvailableBalance, false);
});

test('ignores "Total due: £99.00"', () => {
  const r = extractAvailableBalanceFromText('Total due: £99.00');
  assert.equal(r.hasAvailableBalance, false);
});

test('ignores "Cost per space: £130.00" without credit wording', () => {
  const r = extractAvailableBalanceFromText('Cost per space: £130.00\nSpaces: 1');
  assert.equal(r.hasAvailableBalance, false);
});

test('ignores plain numeric page without credit labels', () => {
  const r = extractAvailableBalanceFromText('Price\n£42.50\nVAT\n£8.50\nTotal\n£51.00');
  assert.equal(r.hasAvailableBalance, false);
});

// =========================================================================
// 3. Balance detection: edge cases
// =========================================================================

test('returns false for empty string', () => {
  const r = extractAvailableBalanceFromText('');
  assert.equal(r.hasAvailableBalance, false);
});

test('returns false for null/undefined', () => {
  assert.equal(extractAvailableBalanceFromText(null).hasAvailableBalance, false);
  assert.equal(extractAvailableBalanceFromText(undefined).hasAvailableBalance, false);
});

test('ignores zero balance credit', () => {
  const r = extractAvailableBalanceFromText('Available balance: £0.00');
  assert.equal(r.hasAvailableBalance, false);
});

test('ignores negative balance credit', () => {
  const r = extractAvailableBalanceFromText('Available balance: £-5.00');
  assert.equal(r.hasAvailableBalance, false);
});

test('credit line next to non-credit line: picks credit, skips non-credit', () => {
  const text = 'Balance due: £120.00\nAvailable balance: £30.00';
  const r = extractAvailableBalanceFromText(text);
  assert.equal(r.hasAvailableBalance, true);
  assert.equal(r.availableBalance, 30);
});

// =========================================================================
// 4. Page-not-ready result shape
// =========================================================================

test('buildPaymentRequestPageNotReadyResult returns retriable failure', () => {
  const result = buildPaymentRequestPageNotReadyResult();
  assert.equal(result.success, false);
  assert.equal(result.paymentCompleted, false);
  assert.equal(result.canRetry, true);
  assert.match(result.error, /did not open/i);
});
