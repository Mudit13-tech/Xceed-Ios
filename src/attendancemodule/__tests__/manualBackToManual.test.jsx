import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Manual from '../manual';

// The Developers and Development Cycle panels replace the step navigator, so
// each must offer an explicit way back to the guide.

describe('Manual — back to manual from the side panels', () => {
    beforeEach(() => {
        window.scrollTo = vi.fn();
    });

    const openPanel = async (name) => {
        const user = userEvent.setup();
        render(<Manual />);
        await user.click(screen.getByRole('button', { name: new RegExp(name, 'i') }));
        return user;
    };

    it.each([
        ['Developers', 'Developers & Contributors'],
        ['Development Cycle', 'Development Cycle'],
    ])('%s panel offers a back control at the top and bottom', async (button, heading) => {
        const user = await openPanel(button);

        expect(screen.getAllByText(heading).length).toBeGreaterThan(0);

        const backButtons = screen.getAllByRole('button', { name: /back to manual/i });
        expect(backButtons).toHaveLength(2);

        await user.click(backButtons[1]);

        // The step navigator is back, and the panel is gone.
        expect(screen.queryByRole('button', { name: /back to manual/i })).toBeNull();
        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('returns to the guide from the top control too', async () => {
        const user = await openPanel('Development Cycle');

        const [topBack] = screen.getAllByRole('button', { name: /back to manual/i });
        await user.click(topBack);

        expect(screen.queryByRole('button', { name: /back to manual/i })).toBeNull();
        // The Development Cycle button itself is still available to reopen it.
        expect(screen.getByRole('button', { name: /Development Cycle/i })).toBeInTheDocument();
    });
});
