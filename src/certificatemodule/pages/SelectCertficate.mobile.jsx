/**
 * The certificate renderer, with its fonts.
 *
 * src/index.mobile.css took the forty-five display families out of the global
 * stylesheet, where they were blocking first paint for every user of the app
 * including the overwhelming majority who never open this module. They still
 * have to arrive for anyone who does: the picker at certificatedesign.jsx:2192
 * is a menu of family names, and a family that never loaded is not an error
 * anywhere -- it is a certificate that quietly prints in Helvetica.
 *
 * This is the one place to ask for them. Every screen that draws a certificate
 * reaches this component: the designer (certificatedesign.jsx), the participant
 * view (participantCerti.jsx) and the templates that compose it
 * (certificatetemplates/akleem/Content.jsx). Hanging the request on the
 * renderer rather than on each of those is what makes it impossible for a
 * screen added later to be the one that forgot.
 *
 * The call sits at module scope on purpose. This module is only ever reached
 * through a lazy route, so evaluating it *is* the moment the certificate module
 * was entered -- earlier than any effect, and early enough that the fonts are
 * usually in hand before there is a certificate on screen to apply them to.
 *
 * Nothing of AMS's is reimplemented here. `./SelectCertficate` from inside an
 * override resolves to the real module (see build/mobileOverrides.js), so this
 * inherits every future upstream change to the renderer; `npm run drift` has
 * nothing to report about a file that only forwards.
 */
import { loadCertificateFonts } from '../../mobile/deferredFonts';

import SelectCertficate from './SelectCertficate';

loadCertificateFonts();

// A forwarding module, not a component module. The rule is about keeping fast
// refresh working across a file that mixes components with other exports, and
// there is nothing here for it to refresh.
// eslint-disable-next-line react-refresh/only-export-components
export * from './SelectCertficate';
export default SelectCertficate;
