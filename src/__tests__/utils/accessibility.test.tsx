import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusTrap } from '../../utils/accessibility';

it('wraps drawer Tab navigation, skips hidden controls and restores the trigger', async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>Assistant trigger</button>
      <section data-testid="drawer-panel">
        <button>First control</button>
        <button style={{ display: 'none' }}>Hidden control</button>
        <button>Last control</button>
      </section>
      <button>Background control</button>
    </>
  );
  const first = screen.getByRole('button', { name: 'First control' });
  const last = screen.getByRole('button', { name: 'Last control' });
  for (const element of [first, last]) {
    const rectangles = [new DOMRect(0, 0, 100, 30)];
    vi.spyOn(element, 'getClientRects').mockReturnValue(
      Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null })
    );
  }
  const trigger = screen.getByRole('button', { name: 'Assistant trigger' });
  await user.click(trigger);
  const trap = new FocusTrap();
  try {
    trap.activate(screen.getByTestId('drawer-panel'));
    expect(first).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
  } finally {
    trap.deactivate();
  }
  expect(trigger).toHaveFocus();
});
