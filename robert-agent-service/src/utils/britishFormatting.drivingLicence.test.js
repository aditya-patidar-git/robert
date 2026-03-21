import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUkLicenceDobBlock,
  validateDrivingLicenceNumber,
  validateDrivingLicenceFirstHalf,
  validateDrivingLicenceSecondHalf
} from './britishFormatting.js';

test('validateUkLicenceDobBlock: male 23 March 1986', () => {
  const r = validateUkLicenceDobBlock('803236');
  assert.equal(r.valid, true);
});

test('validateUkLicenceDobBlock: female 23 March 1986', () => {
  const r = validateUkLicenceDobBlock('853236');
  assert.equal(r.valid, true);
});

test('validateUkLicenceDobBlock: invalid month encoding', () => {
  const r = validateUkLicenceDobBlock('940315');
  assert.equal(r.valid, false);
});

test('validateDrivingLicenceNumber: valid photocard example', () => {
  const r = validateDrivingLicenceNumber('CARTD803236JNA8F');
  assert.equal(r.valid, true);
  assert.equal(r.formatted, 'CARTD803236JNA8F');
});

test('validateDrivingLicenceNumber: rejects old coarse example if DOB invalid', () => {
  const r = validateDrivingLicenceNumber('CARTD940315D9A8F');
  assert.equal(r.valid, false);
});

test('halves concatenate to valid full', () => {
  const r1 = validateDrivingLicenceFirstHalf('CARTD803');
  const r2 = validateDrivingLicenceSecondHalf('236JNA8F');
  assert.equal(r1.valid, true);
  assert.equal(r2.valid, true);
  const full = validateDrivingLicenceNumber(r1.formatted + r2.formatted);
  assert.equal(full.valid, true);
});
