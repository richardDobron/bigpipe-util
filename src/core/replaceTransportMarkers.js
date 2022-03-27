import $ from './$';

export default function replaceTransportMarkers(markerValue, markers, key) {
  const marker = typeof key !== "undefined" ? markers[key] : markers;

  if (Array.isArray(marker)) {
    for (let i = 0; i < marker.length; i++) {
      replaceTransportMarkers(markerValue, marker, i);
    }
  } else {
    if (marker && typeof marker == "object") {
      if (marker.__m) {
        markers[key] = window.require(marker.__m);
      } else if (marker.__e) {
        markers[key] = $(marker.__e);
      } else if (marker.__map) {
        markers[key] = new Map(marker.__map);
      } else if (marker.__set) {
        markers[key] = new Set(marker.__set);
      } else {
        for (let value in marker) {
          replaceTransportMarkers(markerValue, marker, value);
        }
      }
    }
  }
}
