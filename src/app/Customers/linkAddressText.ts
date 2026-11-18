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
  const cname = `Add a CNAME record for ${host} pointing to ${platformHost}.`;
  if (!bareDomain(host)) return cname;
  return `${cname} If the domain already serves a website, give the address a folder (for example https://${host}/wa) and forward that instead.`;
}
