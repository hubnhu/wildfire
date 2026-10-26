const scroller = document.querySelector<HTMLElement>('[data-scroller="projects"]');
if (scroller) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = scroller.querySelector<HTMLElement>('.project-card');
      const step = (card?.getBoundingClientRect().width || 350) + 20;
      scroller.scrollBy({ left: Number(button.dataset.step) * step, behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  });
  let drag: { x: number; left: number } | null = null;
  let moved = false;
  scroller.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: scroller.scrollLeft };
    moved = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (Math.abs(distance) > 5) {
      moved = true;
      scroller.classList.add('dragging');
      window.getSelection()?.removeAllRanges();
      scroller.scrollLeft = drag.left - distance;
    }
  });
  const endDrag = () => { drag = null; scroller.classList.remove('dragging'); };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);
  scroller.addEventListener('dragstart', (event) => event.preventDefault());
  scroller.addEventListener('click', (event) => {
    if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
  }, true);
}
