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

  it('a bare domain without a folder gets both, and the advice to use a folder', () => {
    const both = (host: string) =>
      `${CNAME(host)} If the domain already serves a website, give the address a folder (for example https://${host}/wa) and forward that instead.`;
    expect(customerStep('https://bimalinstitute.com', PLATFORM)).toBe(both('bimalinstitute.com'));
    expect(customerStep('https://bimal.co.in', PLATFORM)).toBe(both('bimal.co.in'));
  });
});
