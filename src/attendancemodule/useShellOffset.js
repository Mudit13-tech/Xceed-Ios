// client/src/attendancemodule/useShellOffset.js

import { useEffect, useRef, useState } from 'react';

// App.jsx renders the global platform <Navbar /> above every route, and it is a
// sticky element in normal document flow — so it takes up real height at the top
// of the page. A module layout that sizes itself to 100dvh therefore ends up
// taller than the window by exactly the navbar's height, and its bottom edge (the
// sidebar footer, the end of the scrollable content) is pushed below the fold.
//
// Measure how far down the document the layout actually starts and let the caller
// subtract that from its own height. Returns [ref, offset]: attach the ref to the
// layout's outermost element. The offset is 0 wherever the navbar isn't rendered
// (login, student-only roles), so the same code works on those routes untouched.
export default function useShellOffset() {
    const ref = useRef(null);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const measure = () => {
            const el = ref.current;
            if (!el) return;
            // Document-relative, so it stays correct even if the window is
            // currently scrolled (which is the very symptom being fixed).
            const top = el.getBoundingClientRect().top + window.scrollY;
            setOffset((prev) => (Math.abs(prev - top) > 0.5 ? top : prev));
        };

        measure();
        window.addEventListener('resize', measure);

        // The navbar mounts only after its /getuser call resolves, so the first
        // measurement almost always happens while it is still absent. Watching
        // the body catches it appearing, and any later change in its height
        // (e.g. the mobile menu expanding).
        let observer;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(measure);
            observer.observe(document.body);
        }

        return () => {
            window.removeEventListener('resize', measure);
            if (observer) observer.disconnect();
        };
    }, []);

    return [ref, offset];
}
