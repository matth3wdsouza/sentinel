// Shared geolocation link builders. No network here — just URL construction
// (opening the link happens in the UI, and coordinates are never logged).
export function osmLink(latitude, longitude, zoom = 15) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=${zoom}`;
}