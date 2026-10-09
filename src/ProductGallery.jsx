import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ProductGallery.css";

const defaultView = { scale: 1, x: 0, y: 0 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ZoomPhoto({ src, name, onPrevious, onNext }) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(null);
  const currentView = useRef(defaultView);
  const [view, setView] = useState(defaultView);

  function updateView(next) {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;

    const scale = clamp(next.scale, 1, 4);
    const fit = Math.min(
      stage.clientWidth / (image.naturalWidth || stage.clientWidth),
      stage.clientHeight / (image.naturalHeight || stage.clientHeight),
    );
    const maxX = Math.max(0, ((image.naturalWidth * fit) * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, ((image.naturalHeight * fit) * scale - stage.clientHeight) / 2);
    const bounded = {
      scale,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
    currentView.current = bounded;
    setView(bounded);
  }

  function zoomTo(scale, point) {
    const rect = stageRef.current.getBoundingClientRect();
    const anchor = point
      ? { x: point.x - rect.left - rect.width / 2, y: point.y - rect.top - rect.height / 2 }
      : { x: 0, y: 0 };
    const previous = currentView.current;
    const ratio = clamp(scale, 1, 4) / previous.scale;
    updateView({
      scale,
      x: anchor.x - (anchor.x - previous.x) * ratio,
      y: anchor.y - (anchor.y - previous.y) * ratio,
    });
  }

  function startGesture(canTap = true) {
    const points = [...pointers.current.values()];
    const previous = currentView.current;
    if (points.length >= 2) {
      gesture.current = {
        kind: "pinch",
        view: previous,
        center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        distance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)),
      };
      lastTap.current = null;
    } else if (points.length === 1) {
      gesture.current = { kind: "drag", start: points[0], view: previous, canTap, moved: false };
    } else {
      gesture.current = null;
    }
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  }

  function handlePointerMove(event) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = gesture.current;
    if (!active) return;

    if (active.kind === "pinch") {
      const [first, second] = [...pointers.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const scale = clamp(active.view.scale * distance / active.distance, 1, 4);
      const rect = stageRef.current.getBoundingClientRect();
      const oldCenter = { x: active.center.x - rect.left - rect.width / 2, y: active.center.y - rect.top - rect.height / 2 };
      const newCenter = { x: (first.x + second.x) / 2 - rect.left - rect.width / 2, y: (first.y + second.y) / 2 - rect.top - rect.height / 2 };
      updateView({
        scale,
        x: newCenter.x - (oldCenter.x - active.view.x) * scale / active.view.scale,
        y: newCenter.y - (oldCenter.y - active.view.y) * scale / active.view.scale,
      });
    } else {
      const dx = event.clientX - active.start.x;
      const dy = event.clientY - active.start.y;
      if (Math.hypot(dx, dy) > 8) active.moved = true;
      if (active.view.scale > 1) {
        updateView({ ...active.view, x: active.view.x + dx, y: active.view.y + dy });
      }
    }
  }

  function finishGesture(event) {
    if (!pointers.current.has(event.pointerId)) return;
    const active = gesture.current;
    pointers.current.delete(event.pointerId);
    if (event.type === "pointerup" && active?.kind === "drag" && active.canTap) {
      const dx = event.clientX - active.start.x;
      const dy = event.clientY - active.start.y;
      if (active.view.scale === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) onNext();
        else onPrevious();
        lastTap.current = null;
      } else if (!active.moved && Math.hypot(dx, dy) < 8) {
        const tap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
        if (lastTap.current && tap.time - lastTap.current.time < 350 && Math.hypot(tap.x - lastTap.current.x, tap.y - lastTap.current.y) < 30) {
          zoomTo(currentView.current.scale > 1 ? 1 : 2.5, tap);
          lastTap.current = null;
        } else {
          lastTap.current = tap;
        }
      }
    }
    startGesture(false);
  }

  useEffect(() => {
    const stage = stageRef.current;
    const observer = new ResizeObserver(() => {
      pointers.current.clear();
      gesture.current = null;
      lastTap.current = null;
      currentView.current = defaultView;
      setView(defaultView);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={stageRef}
        className={`product-zoom-stage${view.scale > 1 ? " is-zoomed" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onLostPointerCapture={finishGesture}
      >
        <img
          ref={imageRef}
          src={src}
          alt={name}
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
      </div>
      <div className="product-zoom-footer">
        <div className="product-zoom-controls" role="group" aria-label="Photo zoom">
          <button type="button" aria-label="Zoom out" disabled={view.scale <= 1} onClick={() => zoomTo(view.scale - 0.5)}>−</button>
          <button type="button" aria-label="Reset zoom" onClick={() => zoomTo(1)}>{Math.round(view.scale * 100)}%</button>
          <button type="button" aria-label="Zoom in" disabled={view.scale >= 4} onClick={() => zoomTo(view.scale + 0.5)}>+</button>
        </div>
        <p>Pinch or double-tap to zoom · Drag to explore</p>
      </div>
    </>
  );
}

function PhotoViewer({ images, name, index, onChange, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) {
        const activePhoto = opener.closest(".product-gallery")?.querySelector('.product-gallery-slide[aria-hidden="false"] button');
        const returnTarget = opener.closest('[aria-hidden="true"]') ? activePhoto : opener;
        returnTarget?.focus({ preventScroll: true });
      }
    };
  }, []);

  function changePhoto(next) {
    const target = clamp(next, 0, images.length - 1);
    if (target === index) return;
    const dialog = dialogRef.current;
    if (dialog.querySelector(".product-zoom-footer")?.contains(document.activeElement)) {
      dialog.querySelector('[aria-label="Close photo viewer"]').focus();
    }
    onChange(target);
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="product-photo-viewer"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
            event.preventDefault();
            first?.focus();
          }
        }
        if (event.key === "ArrowLeft") { event.preventDefault(); changePhoto(index - 1); }
        if (event.key === "ArrowRight") { event.preventDefault(); changePhoto(index + 1); }
      }}
    >
      <header className="product-viewer-header">
        <h2 id={titleId}>{name}</h2>
        <button type="button" className="product-photo-control" onClick={onClose} aria-label="Close photo viewer">Close</button>
      </header>
      <ZoomPhoto key={images[index]} src={images[index]} name={`${name}, photo ${index + 1}`} onPrevious={() => changePhoto(index - 1)} onNext={() => changePhoto(index + 1)} />
      {images.length > 1 && (
        <nav className="product-viewer-navigation" aria-label="Full-screen photos">
          <button type="button" className="product-photo-control" disabled={index === 0} onClick={() => changePhoto(index - 1)} aria-label="Previous photo">←</button>
          <p aria-live="polite" aria-atomic="true">{index + 1} / {images.length}</p>
          <button type="button" className="product-photo-control" disabled={index === images.length - 1} onClick={() => changePhoto(index + 1)} aria-label="Next photo">→</button>
        </nav>
      )}
    </dialog>,
    document.body,
  );
}

export default function ProductGallery({ images, name }) {
  const trackRef = useRef(null);
  const activeRef = useRef(0);
  const touchStart = useRef(null);
  const dragged = useRef(false);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  function goTo(next, smooth = true) {
    const target = clamp(next, 0, images.length - 1);
    const track = trackRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: target * track.clientWidth, behavior: smooth && !reduceMotion ? "smooth" : "instant" });
    activeRef.current = target;
    setIndex(target);
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => {
      track.scrollTo({ left: activeRef.current * track.clientWidth, behavior: "instant" });
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  if (images.length === 0) return <p>Photos coming soon.</p>;

  return (
    <section className="product-gallery" aria-label={`${name} photos`} aria-roledescription="carousel">
      <div
        ref={trackRef}
        className="product-gallery-track"
        onScroll={(event) => {
          const track = event.currentTarget;
          const next = clamp(Math.round(track.scrollLeft / track.clientWidth), 0, images.length - 1);
          activeRef.current = next;
          setIndex(next);
        }}
        onPointerDown={(event) => {
          touchStart.current = { x: event.clientX, y: event.clientY };
          dragged.current = false;
        }}
        onPointerMove={(event) => {
          const start = touchStart.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) dragged.current = true;
        }}
        onPointerCancel={() => { dragged.current = true; touchStart.current = null; }}
        onPointerUp={() => { touchStart.current = null; }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const next = clamp(index + (event.key === "ArrowLeft" ? -1 : 1), 0, images.length - 1);
            goTo(next);
            trackRef.current.children[next].querySelector("button").focus({ preventScroll: true });
          }
        }}
      >
        {images.map((src, photoIndex) => (
          <div className="product-gallery-slide" key={`${src}-${photoIndex}`} role="group" aria-roledescription="slide" aria-label={`${photoIndex + 1} of ${images.length}`} aria-hidden={photoIndex !== index}>
            <button
              type="button"
              className="product-gallery-photo"
              aria-label={`Enlarge photo ${photoIndex + 1} of ${name}`}
              aria-haspopup="dialog"
              tabIndex={photoIndex === index ? 0 : -1}
              onClick={(event) => {
                if (event.detail > 0 && dragged.current) return;
                goTo(photoIndex, false);
                setViewerOpen(true);
              }}
            >
              <img src={src} alt={`${name}, photo ${photoIndex + 1}`} draggable={false} loading={photoIndex > 0 ? "lazy" : "eager"} />
            </button>
          </div>
        ))}
      </div>
      <div className="product-gallery-toolbar">
        {images.length > 1 && <button type="button" className="product-photo-control" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous photo">←</button>}
        <p className="product-gallery-counter" aria-live="polite" aria-atomic="true">{index + 1} / {images.length}</p>
        {images.length > 1 && <button type="button" className="product-photo-control" onClick={() => goTo(index + 1)} disabled={index === images.length - 1} aria-label="Next photo">→</button>}
        <button type="button" className="product-photo-control product-gallery-enlarge" aria-haspopup="dialog" onClick={() => setViewerOpen(true)}>Zoom</button>
      </div>
      <p className="product-gallery-hint">{images.length > 1 ? "Swipe for more photos · Tap to zoom" : "Tap photo to zoom"}</p>
      {viewerOpen && <PhotoViewer images={images} name={name} index={index} onChange={(next) => goTo(next, false)} onClose={() => setViewerOpen(false)} />}
    </section>
  );
}
