import type { PagesAddressStatus } from '@app/api/pagesAddresses';

export const STATUS_TEXT: Record<PagesAddressStatus, string> = {
  UNCHECKED: 'Not checked',
  WORKING: 'Working',
  FAILING: 'Failing',
};

/** Two-letter second-level pairs such as co.in, where three labels still make a bare domain. */
const SHORT_PAIR = /^[a-z]{2,3}\.[a-z]{2}$/;

function bareDomain(host: string): boolean {
  const labels = host.split('.');
  if (labels.length === 2) return true;
  return labels.length === 3 && SHORT_PAIR.test(labels.slice(1).join('.')) && labels[1].length <= 3;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * What the customer must do for the address being typed (link addresses spec §5.9): a CNAME record for a
 * subdomain, forwarding of the two page paths for an address with a folder. Null until the address can be read.
 */
export function customerStep(typed: string, platformBaseUrl: string): string | null {
  const text = typed.trim();
  if (!/^https:\/\//i.test(text)) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host || host.indexOf('.') < 0) return null;
  const folder = url.pathname.replace(/\/+$/, '');
  const platformHost = hostOf(platformBaseUrl);
  if (folder) {
    return `Forward https://${host}${folder}/t/ and https://${host}${folder}/f/ to ${platformBaseUrl}, removing ${folder}.`;
  }
  if (!bareDomain(host)) return `Add a CNAME record for ${host} pointing to ${platformHost}.`;
  // DNS allows no CNAME at a zone's apex (spec §5.9: a bare domain is forwarded)
  return (
    `A bare domain cannot take a CNAME record. Use a subdomain (for example https://links.${host}) and add a CNAME ` +
    `record for it pointing to ${platformHost}, or give the address a folder (for example https://${host}/wa) and ` +
    `forward https://${host}/wa/t/ and https://${host}/wa/f/ to ${platformBaseUrl}, removing /wa.`
  );
}
