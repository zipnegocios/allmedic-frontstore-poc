import { describe, it, expect, vi } from 'vitest';
import { stopCardNavigation } from '../AdminListCard';

describe('stopCardNavigation', () => {
  it('detiene la propagación del evento', () => {
    const stopPropagation = vi.fn();
    stopCardNavigation({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
