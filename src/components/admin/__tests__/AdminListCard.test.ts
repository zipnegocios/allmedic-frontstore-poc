import { describe, it, expect, vi } from 'vitest';
import { stopCardNavigation } from '../AdminListCard';

describe('stopCardNavigation', () => {
  it('detiene la propagación del evento', () => {
    const stopPropagation = vi.fn();
    stopCardNavigation({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('detiene la propagación de un evento de mouse (click)', () => {
    // Simula la forma mínima de un React.MouseEvent, como el que recibe
    // `onClick` en los contenedores de `inlineControl` y `actions`.
    const stopPropagation = vi.fn();
    const mouseEvent = {
      type: 'click',
      stopPropagation,
    };
    stopCardNavigation(mouseEvent);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('detiene la propagación de un evento de teclado (Enter/Space)', () => {
    // Simula la forma mínima de un React.KeyboardEvent, como el que recibe
    // `onKeyDown` en los mismos contenedores. Este es el caso que before del
    // fix NO estaba cubierto: un Enter/Space dentro del Select o del menú de
    // acciones (⋮) burbujeaba hasta el `onKeyDown` del `Card` y disparaba
    // `navigate()` además de abrir el popover de Radix.
    const stopPropagation = vi.fn();
    const keyboardEvent = {
      type: 'keydown',
      key: 'Enter',
      stopPropagation,
    };
    stopCardNavigation(keyboardEvent);
    expect(stopPropagation).toHaveBeenCalledTimes(1);

    const stopPropagationSpace = vi.fn();
    const spaceEvent = {
      type: 'keydown',
      key: ' ',
      stopPropagation: stopPropagationSpace,
    };
    stopCardNavigation(spaceEvent);
    expect(stopPropagationSpace).toHaveBeenCalledTimes(1);
  });
});

// Nota sobre cobertura: este archivo sigue la convención del repo de "no
// render testing" (sin @testing-library/react ni jsdom para simular
// burbujeo real de eventos DOM). El fix en `AdminListCard.tsx` agrega
// `onKeyDown={stopCardNavigation}` a los mismos contenedores que ya tenían
// `onClick={stopCardNavigation}` (inlineControl y actions), de modo que
// ambos tipos de evento se detienen con el mismo helper antes de llegar al
// `onKeyDown` del `Card`. Verificar el contrato de burbujeo real (que un
// Enter dentro del `Select`/`DropdownMenuTrigger` no dispare `navigate()`)
// requeriría una prueba de integración con render + DOM (p. ej.
// @testing-library/react + user-event), que no existe en este repo hoy. Si
// se agrega esa infraestructura en el futuro, este es el escenario a cubrir.
