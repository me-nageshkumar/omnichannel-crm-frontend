import { describe, expect, it } from 'vitest';
import { CAPTURED_TEST, OPTIONS, WAITING_TEST } from '../../test/automations';
import type { EventData } from '@app/api/automations';
import {
  actualLabel,
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

  it('actualLabelNamesWhatTheFieldStores', () => {
    const data = CAPTURED_TEST.captured?.data as EventData;
    expect(actualLabel('number', 'n1', OPTIONS, data)).toBe('Main line');
    expect(actualLabel('number', ['n1', 'n2'], OPTIONS, data)).toBe('Main line, Sales line');
    expect(actualLabel('message.type', 'PHOTO', OPTIONS, data)).toBe('Photo');
    expect(actualLabel('message.type', ['TEXT', 'AUDIO'], OPTIONS, data)).toBe('Text, Audio / voice note');
    expect(actualLabel('pipeline', 'p1', OPTIONS, data)).toBe('Sales');
    expect(actualLabel('toLane', 's3', OPTIONS, data)).toBe('Sales › Won');
    expect(actualLabel('fromLane', 's1', OPTIONS, data)).toBe('Sales › New');
    expect(actualLabel('toLane.type', 'LOST', OPTIONS, data)).toBe('Lost');
    expect(actualLabel('deal.owner', 'u1', OPTIONS, data)).toBe('Demo Agent');
    expect(actualLabel('chat.new', true, OPTIONS, data)).toBe('yes');
    expect(actualLabel('deal.owner', null, OPTIONS, data)).toBe('empty');
    expect(actualLabel('message.text', 'Hello', OPTIONS, data)).toBe('Hello');
    expect(actualLabel('deal.amount', 5000, OPTIONS, data)).toBe('5000');
  });

  it('actualLabelFallsBackToTheEventsNames', () => {
    const data: EventData = {
      ...(CAPTURED_TEST.captured?.data as EventData),
      number: { id: 'n9', number: '919900000009', label: null },
      deal: {
        id: 'd1',
        title: 'Big order',
        status: 'OPEN',
        amount: null,
        currency: null,
        owner: { id: 'u9', name: 'Gone Agent' },
        lostReason: null,
      },
      pipeline: { id: 'p9', name: 'Old pipeline' },
      fromLane: { id: 's8', name: 'Archived', type: 'OPEN' },
      toLane: { id: 's9', name: 'Closed', type: 'WON' },
    };
    expect(actualLabel('number', 'n9', OPTIONS, data)).toBe('+919900000009');
    expect(actualLabel('pipeline', 'p9', OPTIONS, data)).toBe('Old pipeline');
    expect(actualLabel('toLane', 's9', OPTIONS, data)).toBe('Closed');
    expect(actualLabel('fromLane', 's8', OPTIONS, data)).toBe('Archived');
    expect(actualLabel('deal.owner', 'u9', OPTIONS, data)).toBe('Gone Agent');
    expect(actualLabel('number', 'n7', OPTIONS, null)).toBe('n7');
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
