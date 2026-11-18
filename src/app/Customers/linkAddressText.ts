import type { PagesAddressStatus } from '@app/api/pagesAddresses';

export const STATUS_TEXT: Record<PagesAddressStatus, string> = {
  UNCHECKED: 'Not checked',
  WORKING: 'Working',
  FAILING: 'Failing',
};

/**
 * Second-level names under which a registrable domain has three labels (bimal.co.in, bimal.com.au). A short middle
 * label alone proves nothing: wa.tcs.in is a subdomain of tcs.in.
 */
const SECOND_LEVEL = 'ac co com edu firm gen gov ind ltd mil net nic or org plc res sch'.split(' ');

function bareDomain(host: string): boolean {
  const labels = host.split('.');
  if (labels.length === 2) return true;
  return labels.length === 3 && /^[a-z]{2}$/.test(labels[2]) && SECOND_LEVEL.indexOf(labels[1]) >= 0;
}

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const FOLDER_PART = /^[A-Za-z0-9_-]+$/;

/**
 * The host and folder of an address the server would take (PagesUrl on the server): https, a dotted ASCII domain
 * name, no IP, port, user, query or fragment, and up to three folder parts of letters, digits, - and _. Else null.
 */
function readAddress(typed: string): { host: string; folder: string } | null {
  const text = typed.trim();
  if (text.slice(0, 8).toLowerCase() !== 'https://') return null;
  const rest = text.slice(8);
  const slash = rest.indexOf('/');
  const authority = slash < 0 ? rest : rest.slice(0, slash);
  const raw = slash < 0 ? '' : rest.slice(slash);
  if (/[@?#:\[]/.test(authority) || /[?#]/.test(raw)) return null;
  const host = authority.toLowerCase().replace(/\.+$/, '');
  if (!HOST.test(host) || IPV4.test(host)) return null;
  const folder = raw.replace(/\/$/, '');
  if (folder) {
    const parts = folder.slice(1).split('/');
    if (parts.length > 3 || parts.some((part) => !FOLDER_PART.test(part))) return null;
  }
  return { host, folder };
}

/** The host of a typed address the server would take, else null. */
export function typedHost(typed: string): string | null {
  return readAddress(typed)?.host ?? null;
}

/**
 * True for a subdomain without a folder: the one case where our server gets the certificate (Caddy, on the first
 * visit). A folder address is served by the customer's own server and certificate; a bare domain is told to use one of
 * the two.
 */
export function needsCertificate(typed: string): boolean {
  const read = readAddress(typed);
  return read !== null && !read.folder && !bareDomain(read.host);
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
 * subdomain, forwarding of the two page paths for an address with a folder. Null for an address the server would
 * refuse, so no advice is given for it.
 */
export function customerStep(typed: string, platformBaseUrl: string): string | null {
  const read = readAddress(typed);
  if (!read) return null;
  const { host, folder } = read;
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
