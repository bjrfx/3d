import { useState } from 'react';
import { AttributeManager } from './AttributeManager';

export const PropertyDrawer = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={open ? 'Close Property Drawer' : 'Open Property Drawer'}
        className={open ? 'property-drawer__hamburger is-open' : 'property-drawer__hamburger'}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      <aside className={open ? 'property-drawer is-open' : 'property-drawer'} role="complementary" aria-label="Property drawer">
        <div className="property-drawer__header">
          <p className="property-drawer__title">Property Editor</p>
          <button
            aria-label="Close Property Drawer"
            className="property-drawer__close"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="property-drawer__content">
          <AttributeManager />
        </div>
      </aside>

      {open && <button aria-label="Close drawer overlay" className="property-drawer__backdrop" onClick={() => setOpen(false)} type="button" />}
    </>
  );
};
