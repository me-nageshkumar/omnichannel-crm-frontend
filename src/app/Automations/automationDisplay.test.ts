import { describe, expect, it } from 'vitest';
import { OPTIONS, WAITING_TEST } from '../../test/automations';
import {
  actualText,
  endedText,
  eventLabel,
  outcomeColor,
  outcomeLabel,
  runStatusLabel,
  statusColor,
  statusLabel,
  waitingText,
} from './automationDisplay';

describe('automationDisplay', () => {
  it('waitingTextNamesContactAndNumbers', () => {
    const t = {
      ...WAITING_TEST,
      target: { contactId: 'c1', name: 'Asha', phone: '919876543210' },
      numbers: [
        { id: 'n1', number: '1', label: 'Main line' },
        { id: 'n2', number: '2', label: 'Sales line' },
      ],
    };
    expect(waitingText(t, OPTIONS)).toBe("Send a message from Asha's phone to Main line or Sales line.");
  });

  it('waitingTextForTypedNumber', () => {
    const t = { ...WAITING_TEST, target: { contactId: null, name: null, phone: '919811100009' } };
    expect(waitingText(t, OPTIONS)).toContain("+919811100009's phone");
  });

  it('waitingTextForLaneEvent', () => {
    const t = { ...WAITING_TEST, event: 'DEAL_LANE_CHANGED' as const };
    expect(waitingText(t, OPTIONS)).toBe("Move one of Asha Rao's deals to another lane.");
  });

  it('endedTextPerReason', () => {
    expect(endedText('IDLE')).toBe('The test ended: nothing happened for 30 minutes.');
    expect(endedText('RULE_PUBLISHED')).toBe('The test ended because the rule was published.');
    expect(endedText('RULE_DELETED')).toBe('The test ended because the rule was deleted.');
    expect(endedText('DONE')).toBe('The test is done.');
    expect(endedText(null)).toBe('The test is done.');
  });

  it('actualTextFormats', () => {
    expect(actualText(null)).toBe('empty');
    expect(actualText(true)).toBe('yes');
    expect(actualText(false)).toBe('no');
    expect(actualText(['a', 'b'])).toBe('a, b');
    expect(actualText(42)).toBe('42');
    expect(actualText('hi')).toBe('hi');
  });

  it('labels and colours', () => {
    expect(statusLabel('DRAFT')).toBe('Draft');
    expect(statusLabel('PUBLISHED')).toBe('Published');
    expect(statusColor('DRAFT')).toBe('grey');
    expect(statusColor('PUBLISHED')).toBe('green');
    expect(eventLabel('MESSAGE_RECEIVED')).toBe('A message comes in');
    expect(eventLabel('DEAL_LANE_CHANGED')).toBe('A deal moves to another lane');
    expect(outcomeLabel('RETRYING')).toBe('Retrying');
    expect(outcomeLabel(null)).toBe('');
    expect(outcomeColor('FAILED')).toBe('red');
    expect(runStatusLabel('TESTING')).toBe('Testing');
  });
});
