import { describe, expect, it } from 'vitest';
import { DEFAULT_DBX_MAPBOX_POPUP_OFFSET, mapboxPopupAnchorOffset, mapboxPopupPanIntoViewOffset, mapboxScreenRectIntersection } from './mapbox.popup';

describe('mapboxPopupAnchorOffset()', () => {
  const offset = mapboxPopupAnchorOffset({ x: 30, y: 10 });

  it('should move the popup up when it opens above the anchor point', () => {
    expect(offset.bottom).toEqual([0, -10]);
    expect(offset['bottom-left']).toEqual([0, -10]);
    expect(offset['bottom-right']).toEqual([0, -10]);
  });

  it('should move the popup down when it opens below the anchor point', () => {
    expect(offset.top).toEqual([0, 10]);
    expect(offset['top-left']).toEqual([0, 10]);
    expect(offset['top-right']).toEqual([0, 10]);
  });

  it('should move the popup sideways when it opens beside the anchor point', () => {
    expect(offset.left).toEqual([30, 0]);
    expect(offset.right).toEqual([-30, 0]);
  });

  it('should not move a centered popup', () => {
    expect(offset.center).toEqual([0, 0]);
  });

  it('should define an offset for every anchor in the default offset', () => {
    expect(Object.keys(DEFAULT_DBX_MAPBOX_POPUP_OFFSET)).toHaveLength(9);
  });
});

describe('mapboxPopupPanIntoViewOffset()', () => {
  const view = { left: 0, top: 0, right: 1000, bottom: 800 };
  const padding = 10;

  it('should not pan when the popup fits', () => {
    expect(
      mapboxPopupPanIntoViewOffset({
        popup: { left: 100, top: 100, right: 440, bottom: 450 },
        view,
        padding
      })
    ).toEqual([0, 0]);
  });

  it('should pan the camera up and left when the popup is cut off at the top and left', () => {
    expect(
      mapboxPopupPanIntoViewOffset({
        popup: { left: -50, top: -100, right: 290, bottom: 250 },
        view,
        padding
      })
    ).toEqual([-60, -110]);
  });

  it('should pan the camera down and right when the popup is cut off at the bottom and right', () => {
    expect(
      mapboxPopupPanIntoViewOffset({
        popup: { left: 800, top: 600, right: 1140, bottom: 950 },
        view,
        padding
      })
    ).toEqual([150, 160]);
  });

  it('should keep the top of the popup visible when it is taller than the view', () => {
    expect(
      mapboxPopupPanIntoViewOffset({
        popup: { left: 100, top: 300, right: 440, bottom: 650 },
        view: { left: 0, top: 0, right: 1000, bottom: 300 },
        padding
      })
    ).toEqual([0, 290]);
  });

  it('should measure against a view that does not start at the window origin', () => {
    expect(
      mapboxPopupPanIntoViewOffset({
        popup: { left: 300, top: 40, right: 640, bottom: 390 },
        view: { left: 200, top: 88, right: 1200, bottom: 900 },
        padding
      })
    ).toEqual([0, -58]);
  });
});

describe('mapboxScreenRectIntersection()', () => {
  it('should clip the first box to the second', () => {
    expect(mapboxScreenRectIntersection({ left: -20, top: 50, right: 1200, bottom: 900 }, { left: 0, top: 0, right: 1000, bottom: 800 })).toEqual({ left: 0, top: 50, right: 1000, bottom: 800 });
  });
});
