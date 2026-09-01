export function readSubtabFromSearch(allowedValues, fallbackValue, queryKey = 'tab', search) {
  const currentSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const requestedValue = new URLSearchParams(currentSearch).get(queryKey);
  return allowedValues.find((value) => String(value) === requestedValue) ?? fallbackValue;
}

export function buildSubtabUrl(value, queryKey = 'tab', extraParams = {}, href) {
  const currentHref = href ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  const url = new URL(currentHref, 'http://localhost');
  url.searchParams.set(queryKey, String(value));
  Object.entries(extraParams).forEach(([key, paramValue]) => {
    if (paramValue === null || paramValue === undefined || paramValue === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(paramValue));
    }
  });
  return `${url.pathname}${url.search}${url.hash}`;
}

export function openSubtabInNewTab(value, queryKey = 'tab', extraParams = {}) {
  const url = buildSubtabUrl(value, queryKey, extraParams);
  window.open(url, '_blank', 'noopener,noreferrer');
}
