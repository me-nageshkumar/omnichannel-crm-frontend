import { describe, expect, it } from 'vitest';
import { customerStep } from '@app/Customers/linkAddressText';

const PLATFORM = 'https://go.example.in';
const CNAME = (host: string) => `Add a CNAME record for ${host} pointing to go.example.in.`;
const FORWARD = (host: string, folder: string) =>
  `Forward https://${host}${folder}/t/ and https://${host}${folder}/f/ to ${PLATFORM}, removing ${folder}.`;

describe('the customer’s set-up step', () => {
  it('says nothing until the address can be read', () => {
    for (const typed of ['', '   ', 'links', 'http://x.in', 'https://x', 'https://', 'ftp://x.in']) {
      expect(customerStep(typed, PLATFORM)).toBeNull();
    }
  });

  it('a subdomain needs a CNAME record', () => {
    expect(customerStep('https://user-task.bimalinstitute.com', PLATFORM)).toBe(CNAME('user-task.bimalinstitute.com'));
    expect(customerStep(' https://User-Task.BimalInstitute.com/ ', PLATFORM)).toBe(
      CNAME('user-task.bimalinstitute.com'),
    );
    expect(customerStep('https://a.b.bimal.co.in', PLATFORM)).toBe(CNAME('a.b.bimal.co.in'));
  });

  it('an address with a folder needs forwarding with the folder removed', () => {
    expect(customerStep('https://bimalinstitute.com/wa', PLATFORM)).toBe(FORWARD('bimalinstitute.com', '/wa'));
    expect(customerStep('https://links.bimal.in/a/b/', PLATFORM)).toBe(FORWARD('links.bimal.in', '/a/b'));
  });

  it('a bare domain without a folder is told it cannot take a CNAME, and given both ways that work', () => {
    const bare = (host: string) =>
      `A bare domain cannot take a CNAME record. Use a subdomain (for example https://links.${host}) and add a CNAME record for it pointing to go.example.in, or give the address a folder (for example https://${host}/wa) and forward https://${host}/wa/t/ and https://${host}/wa/f/ to ${PLATFORM}, removing /wa.`;
    expect(customerStep('https://bimalinstitute.com', PLATFORM)).toBe(bare('bimalinstitute.com'));
    expect(customerStep('https://bimal.co.in', PLATFORM)).toBe(bare('bimal.co.in'));
    expect(customerStep('https://bimalinstitute.com', PLATFORM)).not.toContain(
      'Add a CNAME record for bimalinstitute.com',
    );
  });
});
