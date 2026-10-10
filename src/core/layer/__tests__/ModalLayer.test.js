import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HideOnBlur from '../HideOnBlur';
import Layer from '../Layer';
import ModalLayer from '../ModalLayer';

let layers;

beforeEach(() => {
  layers = [];
  document.body.innerHTML = '<p id="page">Page</p>';
  document.body.style.overflow = '';
});

afterEach(() => {
  layers.forEach(layer => layer.destroy());
});

function create(behaviors = [ModalLayer]) {
  const layer = new Layer('<div class="my-modal">Modal</div>', { behaviors });
  layers.push(layer);
  return layer;
}

describe('ModalLayer', () => {
  it('adds a backdrop before the root and removes it when hidden', () => {
    const layer = create();

    layer.show();
    const root = layer.getRoot();
    const backdrop = root.previousElementSibling;
    expect(backdrop).not.toBeNull();
    expect(backdrop.style.position).toBe('fixed');
    expect(Number(root.style.zIndex)).toBeGreaterThan(Number(backdrop.style.zIndex));

    layer.hide();
    expect(backdrop.isConnected).toBe(false);
  });

  it('centers the root with inline styles and restores them', () => {
    const layer = create();

    layer.show();
    expect(layer.getRoot().style.position).toBe('fixed');
    expect(layer.getRoot().style.transform).toBe('translate(-50%, -50%)');

    layer.hide();
    expect(layer.getRoot().style.position).toBe('');
    expect(layer.getRoot().style.transform).toBe('');
  });

  it('locks the scrolling of the page until the last modal is hidden', () => {
    const lower = create();
    const upper = create();

    lower.show();
    upper.show();
    expect(document.body.style.overflow).toBe('hidden');

    upper.hide();
    expect(document.body.style.overflow).toBe('hidden');

    lower.hide();
    expect(document.body.style.overflow).toBe('');
  });

  it('stacks the modals and shows only the backdrop of the topmost', () => {
    const lower = create();
    const upper = create();

    lower.show();
    upper.show();
    const lowerBackdrop = lower.getRoot().previousElementSibling;
    const upperBackdrop = upper.getRoot().previousElementSibling;

    expect(Number(upper.getRoot().style.zIndex)).toBeGreaterThan(Number(lower.getRoot().style.zIndex));
    expect(lowerBackdrop.style.display).toBe('none');
    expect(upperBackdrop.style.display).toBe('');
    expect(ModalLayer.getTopmostModal().layer).toBe(upper);

    upper.hide();
    expect(lowerBackdrop.style.display).toBe('');
  });

  it('can be configured for your own CSS', () => {
    const Modal = ModalLayer.configure({
      backdropClassName: 'fixed inset-0 bg-black/50',
      center: false,
      lockScroll: false,
      zIndex: 50
    });
    const layer = create([Modal]);

    layer.show();
    const backdrop = layer.getRoot().previousElementSibling;

    expect(backdrop.className).toBe('fixed inset-0 bg-black/50');
    expect(backdrop.style.position).toBe('');
    expect(layer.getRoot().style.position).toBe('');
    expect(layer.getRoot().style.zIndex).toBe('51');
    expect(document.body.style.overflow).toBe('');
  });

  it('removes the backdrop when disabled while shown', () => {
    const layer = create();
    layer.show();
    const backdrop = layer.getRoot().previousElementSibling;

    layer.disableBehaviors([ModalLayer]);

    expect(backdrop.isConnected).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('hides with a click on the backdrop together with HideOnBlur', async () => {
    const layer = create([ModalLayer, HideOnBlur]);
    layer.show();
    await new Promise(resolve => setTimeout(resolve, 0));
    const backdrop = layer.getRoot().previousElementSibling;

    ['mousedown', 'mouseup', 'click'].forEach(type =>
      backdrop.dispatchEvent(new MouseEvent(type, { bubbles: true }))
    );
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(layer.isShown()).toBe(false);
  });
});
